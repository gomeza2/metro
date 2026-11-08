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
    name: 'Red de la mañana',
    objective: 'Conecta los primeros barrios y establece un servicio fiable.',
    goal: 'Transporta 5 personas',
  },
  {
    id: 'stadium-preparation',
    start: 70,
    end: 100,
    name: 'Preparar el estadio',
    objective: 'Conecta el Gran Estadio antes de que llegue el público.',
    goal: 'Conecta el Gran Estadio con otra estación',
  },
  {
    id: 'stadium-arrival',
    start: 100,
    end: 160,
    name: 'Llegada al estadio',
    objective: 'Lleva al menos cinco personas al Gran Estadio.',
    goal: 'Lleva 5 personas al Gran Estadio',
  },
  {
    id: 'post-event-return',
    start: 160,
    end: 205,
    name: 'Regreso del evento',
    objective: 'Lleva de regreso al público del estadio.',
    goal: 'Transporta 5 personas desde el Gran Estadio',
  },
  {
    id: 'afternoon-commute',
    start: 205,
    end: 320,
    name: 'Regreso de la tarde',
    objective: 'Equilibra la demanda de la tarde y llega a 55 viajes completados.',
    goal: 'Transporta 55 personas en total',
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
