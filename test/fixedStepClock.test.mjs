import test from 'node:test';
import assert from 'node:assert/strict';
import { FixedStepClock } from '../.test-build/simulation/fixedStepClock.js';

const STEP = 1 / 60;

test('waits for a complete fixed step and carries the fractional remainder', () => {
  const clock = new FixedStepClock();
  const updates = [];

  const first = clock.advance(STEP / 2, 1, (dt) => updates.push(dt));
  const second = clock.advance(STEP / 2, 1, (dt) => updates.push(dt));

  assert.equal(first.steps, 0);
  assert.equal(first.interpolationAlpha, 0.5);
  assert.equal(second.steps, 1);
  assert.deepEqual(updates, [STEP]);
  assert.equal(second.interpolationAlpha, 0);
});

test('1x, 2x and 3x multiply simulated time without changing the fixed update size', () => {
  for (const speed of [1, 2, 3]) {
    const clock = new FixedStepClock();
    const updates = [];
    const result = clock.advance(STEP, speed, (dt) => updates.push(dt));

    assert.equal(result.steps, speed);
    assert.deepEqual(updates, Array.from({ length: speed }, () => STEP));
  }
});

test('different render-frame groupings produce the same simulation updates', () => {
  const oneFrameClock = new FixedStepClock();
  const splitFrameClock = new FixedStepClock();
  let oneFrameUpdates = 0;
  let splitFrameUpdates = 0;

  oneFrameClock.advance(STEP, 1, () => { oneFrameUpdates += 1; });
  for (let frame = 0; frame < 4; frame += 1) {
    splitFrameClock.advance(STEP / 4, 1, () => { splitFrameUpdates += 1; });
  }

  assert.equal(oneFrameUpdates, 1);
  assert.equal(splitFrameUpdates, oneFrameUpdates);
});

test('clamps long render frames and safely catches up at 3x speed', () => {
  const clock = new FixedStepClock();
  let updates = 0;

  const result = clock.advance(2, 3, () => { updates += 1; });

  assert.equal(result.steps, 9);
  assert.equal(updates, 9);
  assert.equal(result.droppedSeconds, 0);
  assert.equal(result.interpolationAlpha, 0);
});

test('limits catch-up work and drops only excess whole steps', () => {
  const clock = new FixedStepClock({
    maxFrameDeltaSeconds: 0.2,
    maxStepsPerFrame: 2,
  });
  let updates = 0;

  const result = clock.advance(STEP * 6, 1, () => { updates += 1; });

  assert.equal(updates, 2);
  assert.equal(result.steps, 2);
  assert.ok(Math.abs(result.droppedSeconds - STEP * 4) < 1e-10);
  assert.equal(result.interpolationAlpha, 0);
});

test('negative and non-finite frame values do not advance the simulation', () => {
  const clock = new FixedStepClock();
  let updates = 0;

  clock.advance(-1, 1, () => { updates += 1; });
  clock.advance(Number.NaN, 1, () => { updates += 1; });
  clock.advance(STEP, Number.NaN, () => { updates += 1; });
  clock.advance(STEP, -2, () => { updates += 1; });

  assert.equal(updates, 0);
});

test('reset clears a partial step before a new run', () => {
  const clock = new FixedStepClock();
  let updates = 0;

  clock.advance(STEP / 2, 1, () => { updates += 1; });
  clock.reset();
  const result = clock.advance(STEP / 2, 1, () => { updates += 1; });

  assert.equal(updates, 0);
  assert.equal(result.steps, 0);
  assert.equal(result.interpolationAlpha, 0.5);
});

test('rejects invalid clock configuration', () => {
  assert.throws(() => new FixedStepClock({ stepSeconds: 0 }), RangeError);
  assert.throws(() => new FixedStepClock({ maxFrameDeltaSeconds: -1 }), RangeError);
  assert.throws(() => new FixedStepClock({ maxStepsPerFrame: 1.5 }), RangeError);
});
