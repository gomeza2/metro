import { getShiftPhase } from './shiftPhases.js';

export type PassengerDistrictKind = 'residential' | 'commerce' | 'culture' | 'civic' | 'leisure';

export interface DemandStation {
  readonly id: string;
  readonly kind: PassengerDistrictKind;
  readonly queueLength: number;
}

export interface PassengerTripCandidate<TPayload = unknown> {
  readonly from: DemandStation;
  readonly to: DemandStation;
  readonly route: readonly string[];
  readonly payload: TPayload;
}

export interface PassengerDemandContext {
  readonly elapsed: number;
  readonly hour: number;
}

/**
 * Calculates the relative chance of a trip for the current city time and shift.
 * The result is a weight, not a probability; weights are normalized only when
 * a candidate is selected.
 */
export function passengerTripWeight<TPayload>(
  candidate: PassengerTripCandidate<TPayload>,
  context: PassengerDemandContext,
): number {
  const { from, to } = candidate;
  const { elapsed, hour } = context;
  let weight = 1;

  if (hour >= 7 && hour < 10 && from.kind === 'residential') weight *= 2.7;
  if (hour >= 7 && hour < 10 && ['commerce', 'culture', 'civic'].includes(to.kind)) weight *= 1.7;
  if (hour >= 11 && hour < 14 && ['commerce', 'culture', 'leisure'].includes(to.kind)) weight *= 1.45;
  if (hour >= 16 && hour < 20 && ['commerce', 'culture', 'civic'].includes(from.kind)) weight *= 2.2;
  if (hour >= 16 && hour < 20 && to.kind === 'residential') weight *= 1.8;

  // The same phase definition drives the mission HUD, event panel and demand.
  switch (getShiftPhase(elapsed).id) {
    case 'morning-network':
      if (from.kind === 'residential') weight *= 1.8;
      if (['commerce', 'culture', 'civic'].includes(to.kind)) weight *= 1.35;
      break;
    case 'stadium-preparation':
      if (to.id === 'stadium') weight *= 3.4;
      if (from.id === 'stadium') weight *= 0.12;
      break;
    case 'stadium-arrival':
      if (to.id === 'stadium') weight *= 7.2;
      if (from.id === 'stadium') weight *= 0.08;
      break;
    case 'post-event-return':
      if (from.id === 'stadium') weight *= 8.4;
      if (to.id === 'stadium') weight *= 0.08;
      if (to.kind === 'residential') weight *= 1.4;
      break;
    case 'afternoon-commute':
      if (from.kind !== 'residential') weight *= 1.55;
      if (to.kind === 'residential') weight *= 2.1;
      if (to.id === 'stadium') weight *= 0.5;
      break;
  }

  return weight;
}

/**
 * Selects a candidate using weighted randomness. The random source is injected
 * so gameplay behavior can be tested deterministically without changing rules.
 *
 * Stations with fewer than ten people waiting are preferred. If every origin
 * has reached that level, the system falls back to the complete valid pool.
 */
export function selectPassengerTrip<TPayload>(
  candidates: readonly PassengerTripCandidate<TPayload>[],
  context: PassengerDemandContext,
  random: () => number = Math.random,
): PassengerTripCandidate<TPayload> | null {
  if (candidates.length === 0) return null;

  const lowerPressure = candidates.filter((candidate) => candidate.from.queueLength < 10);
  const pool = lowerPressure.length > 0 ? lowerPressure : candidates;
  const weighted = pool.map((candidate) => ({
    candidate,
    weight: passengerTripWeight(candidate, context),
  }));
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);

  if (!Number.isFinite(totalWeight) || totalWeight <= 0) return null;

  const sample = random();
  if (!Number.isFinite(sample)) return null;
  const boundedSample = Math.max(0, Math.min(sample, 1 - Number.EPSILON));
  let roll = boundedSample * totalWeight;

  for (const item of weighted) {
    roll -= item.weight;
    if (roll <= 0) return item.candidate;
  }

  // Floating-point rounding can leave a tiny positive remainder.
  return weighted[weighted.length - 1]?.candidate ?? null;
}
