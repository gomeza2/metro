import type { GameSimulationState } from './gameSimulation.js';
import type { MetroLine } from './gameTypes.js';
import { getShiftPhaseIndex } from './shiftPhases.js';

export const PHASE_REWARD = 8;
export type UpgradeKind = 'capacity' | 'express';
export type PurchaseResult = { ok: true; cost: number; level: number } | { ok: false; reason: 'maxed' | 'funds'; cost: number };

export function phaseGoal(index: number, state: GameSimulationState, lines: readonly MetroLine[]): { current: number; target: number } {
  switch (index) {
    case 0: return { current: state.score, target: 5 };
    case 1: return { current: lines.some(line => line.stations.length >= 2 && line.stations.includes('stadium')) ? 1 : 0, target: 1 };
    case 2: return { current: state.stadiumArrivalsDelivered, target: 5 };
    case 3: return { current: state.stadiumDeparturesDelivered, target: 5 };
    default: return { current: state.score, target: 55 };
  }
}

/** Run-scoped upgrades and phase grants. HUD reads never award or spend funds. */
export class RunEconomy {
  capacityLevel = 1;
  expressLevel = 1;
  readonly completedPhases = new Set<number>();

  cost(kind: UpgradeKind): number {
    return kind === 'capacity' ? 12 + (this.capacityLevel - 1) * 14 : 10 + (this.expressLevel - 1) * 12;
  }

  buy(kind: UpgradeKind, state: { credits: number }): PurchaseResult {
    const level = kind === 'capacity' ? this.capacityLevel : this.expressLevel;
    const cost = this.cost(kind);
    if (level >= 3) return { ok: false, reason: 'maxed', cost };
    if (!Number.isFinite(state.credits) || state.credits < cost) return { ok: false, reason: 'funds', cost };
    state.credits -= cost;
    if (kind === 'capacity') this.capacityLevel += 1;
    else this.expressLevel += 1;
    return { ok: true, cost, level: level + 1 };
  }

  awardPhase(state: GameSimulationState, lines: readonly MetroLine[]): number {
    const index = getShiftPhaseIndex(state.elapsed);
    if (this.completedPhases.has(index)) return 0;
    const goal = phaseGoal(index, state, lines);
    if (goal.current < goal.target) return 0;
    this.completedPhases.add(index);
    state.credits += PHASE_REWARD;
    return PHASE_REWARD;
  }

  reset(): void {
    this.capacityLevel = 1;
    this.expressLevel = 1;
    this.completedPhases.clear();
  }
}
