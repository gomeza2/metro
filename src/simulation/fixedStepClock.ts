export interface FixedStepClockOptions {
  stepSeconds?: number;
  maxFrameDeltaSeconds?: number;
  maxStepsPerFrame?: number;
}

export interface FixedStepAdvance {
  /** Number of fixed simulation updates executed for this rendered frame. */
  steps: number;
  /** Remaining fraction of a simulation step, suitable for future render interpolation. */
  interpolationAlpha: number;
  /** Whole simulation seconds intentionally discarded to prevent a catch-up spiral. */
  droppedSeconds: number;
}

/**
 * Converts variable render-frame deltas into deterministic-size simulation updates.
 *
 * The clock deliberately knows nothing about the game state or browser APIs. The
 * caller owns the update callback and decides when the clock should be reset.
 */
export class FixedStepClock {
  readonly stepSeconds: number;
  readonly maxFrameDeltaSeconds: number;
  readonly maxStepsPerFrame: number;

  private accumulatorSeconds = 0;

  constructor(options: FixedStepClockOptions = {}) {
    const stepSeconds = options.stepSeconds ?? 1 / 60;
    const maxFrameDeltaSeconds = options.maxFrameDeltaSeconds ?? 0.05;
    const maxStepsPerFrame = options.maxStepsPerFrame ?? 12;

    if (!Number.isFinite(stepSeconds) || stepSeconds <= 0) {
      throw new RangeError('stepSeconds must be a finite number greater than zero.');
    }
    if (!Number.isFinite(maxFrameDeltaSeconds) || maxFrameDeltaSeconds <= 0) {
      throw new RangeError('maxFrameDeltaSeconds must be a finite number greater than zero.');
    }
    if (!Number.isInteger(maxStepsPerFrame) || maxStepsPerFrame < 1) {
      throw new RangeError('maxStepsPerFrame must be a positive integer.');
    }

    this.stepSeconds = stepSeconds;
    this.maxFrameDeltaSeconds = maxFrameDeltaSeconds;
    this.maxStepsPerFrame = maxStepsPerFrame;
  }

  advance(
    frameDeltaSeconds: number,
    speedMultiplier: number,
    update: (stepSeconds: number) => void,
  ): FixedStepAdvance {
    const safeFrameDelta = Number.isFinite(frameDeltaSeconds)
      ? Math.min(Math.max(0, frameDeltaSeconds), this.maxFrameDeltaSeconds)
      : 0;
    const safeSpeed = Number.isFinite(speedMultiplier) ? Math.max(0, speedMultiplier) : 0;
    const scaledDelta = safeFrameDelta * safeSpeed;

    if (Number.isFinite(scaledDelta)) {
      this.accumulatorSeconds += scaledDelta;
    }

    const epsilon = this.stepSeconds * 1e-9;
    let steps = 0;

    while (
      this.accumulatorSeconds + epsilon >= this.stepSeconds
      && steps < this.maxStepsPerFrame
    ) {
      this.accumulatorSeconds -= this.stepSeconds;
      if (this.accumulatorSeconds < 0) this.accumulatorSeconds = 0;
      update(this.stepSeconds);
      steps += 1;
    }

    let droppedSeconds = 0;
    if (this.accumulatorSeconds + epsilon >= this.stepSeconds) {
      const droppedSteps = Math.floor((this.accumulatorSeconds + epsilon) / this.stepSeconds);
      droppedSeconds = droppedSteps * this.stepSeconds;
      this.accumulatorSeconds = Math.max(0, this.accumulatorSeconds - droppedSeconds);
    }

    if (this.accumulatorSeconds < epsilon) this.accumulatorSeconds = 0;

    return {
      steps,
      interpolationAlpha: this.accumulatorSeconds / this.stepSeconds,
      droppedSeconds,
    };
  }

  reset(): void {
    this.accumulatorSeconds = 0;
  }
}
