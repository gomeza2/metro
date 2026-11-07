export type ShiftPhaseId =
  | 'morning-network'
  | 'stadium-preparation'
  | 'stadium-arrival'
  | 'post-event-return'
  | 'afternoon-commute';

export interface ShiftPhase {
  readonly id: ShiftPhaseId;
  readonly start: number;
  readonly end: number;
  readonly name: string;
  readonly objective: string;
  readonly goal: string;
}

/**
 * The only source of truth for gameplay phase boundaries and mission copy.
 * Demand, event presentation, mission HUD, and soundtrack all read this list.
 */
export const SHIFT_PHASES: readonly ShiftPhase[] = Object.freeze([
  {
    id: 'morning-network',
    start: 0,
    end: 70,
    name: 'Morning network',
    objective: 'Connect the first districts and establish reliable passenger service.',
    goal: 'Deliver 5 passengers',
  },
  {
    id: 'stadium-preparation',
    start: 70,
    end: 100,
    name: 'Stadium preparation',
    objective: 'Build a reliable link to Grand Stadium before the crowd arrives.',
    goal: 'Connect Grand Stadium to a metro line',
  },
  {
    id: 'stadium-arrival',
    start: 100,
    end: 160,
    name: 'Stadium arrival rush',
    objective: 'Carry at least five passengers into Grand Stadium.',
    goal: 'Deliver 5 passengers to Grand Stadium',
  },
  {
    id: 'post-event-return',
    start: 160,
    end: 205,
    name: 'Post-event return',
    objective: 'Move the stadium crowd back toward its destinations.',
    goal: 'Deliver 5 passengers from Grand Stadium',
  },
  {
    id: 'afternoon-commute',
    start: 205,
    end: 320,
    name: 'Afternoon & evening commute',
    objective: 'Balance the growing return commute and reach 55 total deliveries.',
    goal: 'Deliver 55 passengers in total',
  },
]);

/**
 * Returns the active phase index. Boundaries are start-inclusive/end-exclusive;
 * time beyond the scheduled shift remains in the final phase.
 */
export function getShiftPhaseIndex(elapsed: number): number {
  const time = Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;

  for (let index = 0; index < SHIFT_PHASES.length; index += 1) {
    const phase = SHIFT_PHASES[index];
    if (phase && time >= phase.start && time < phase.end) return index;
  }

  return SHIFT_PHASES.length - 1;
}

export function getShiftPhase(elapsed: number): ShiftPhase {
  return SHIFT_PHASES[getShiftPhaseIndex(elapsed)]!;
}
