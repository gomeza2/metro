export const OPERATING_POLICIES = {
  balanced: { name: 'Equilibrada', speed: 1, seats: 1, dwell: 0.45, description: 'Un servicio versátil: velocidad y capacidad equilibradas.' },
  local: { name: 'Servicio local', speed: 0.82, seats: 1.5, dwell: 0.65, description: '50% más asientos, viajes más lentos y paradas más largas. Útil en recorridos cortos con mucha demanda.' },
  rapid: { name: 'Servicio rápido', speed: 1.28, seats: 0.75, dwell: 0.3, description: '28% más velocidad y paradas cortas, pero menos asientos. Útil para conexiones largas.' },
} as const;
export type OperatingPolicyId = keyof typeof OPERATING_POLICIES;
export const POLICY_CHANGE_COST = 6;
export const trainSeats = (capacityLevel: number, policy: OperatingPolicyId = 'balanced'): number => Math.max(1, Math.floor(6 * capacityLevel * OPERATING_POLICIES[policy].seats));
export const trainSpeed = (expressLevel: number, policy: OperatingPolicyId = 'balanced'): number => 105 * expressLevel * OPERATING_POLICIES[policy].speed;

/** Steady-state average, not a promise about actual fleet spacing or dwell delays. */
export function serviceEstimate(points: readonly { x: number; y: number }[], fleet: number, capacityLevel: number, expressLevel: number, policy: OperatingPolicyId) {
  const distance = points.slice(1).reduce((sum, point, index) => sum + Math.hypot(point.x - points[index]!.x, point.y - points[index]!.y), 0);
  const roundTrip = points.length < 2 ? 0 : 2 * distance / trainSpeed(expressLevel, policy) + 2 * (points.length - 1) * OPERATING_POLICIES[policy].dwell;
  return { distance, roundTrip, headway: fleet > 0 ? roundTrip / fleet : 0, seats: trainSeats(capacityLevel, policy) };
}
