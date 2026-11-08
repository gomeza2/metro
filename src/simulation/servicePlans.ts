export const SERVICE_PLANS = {
  standard: { name: 'City shift', demand: 1, overloadSeconds: 17, startingCredits: 28, ranked: true, description: 'The original five-phase shift. Build, adapt and survive.' },
  relaxed: { name: 'Gentle shift', demand: 0.7, overloadSeconds: 25, startingCredits: 40, ranked: true, description: 'More planning time, lighter demand and $40 to begin.' },
  rush: { name: 'Rush hour', demand: 1.5, overloadSeconds: 12, startingCredits: 28, ranked: true, description: '50% more demand. Just 12 seconds to rescue a critical station.' },
  sandbox: { name: 'Free build', demand: 0.7, overloadSeconds: Infinity, startingCredits: 150, ranked: false, description: 'No overload defeat. $150 to experiment; no ranked score.' },
} as const;
export type ServicePlanId = keyof typeof SERVICE_PLANS;

export type DistrictEvent = { id: string; name: string; stationId: string; start: number; end: number; description: string };
const EVENT_LOCATIONS = [
  { name: 'Museum late opening', stationId: 'museum', description: 'Visitors are heading to Museum Mile. Give the cultural district a direct service.' },
  { name: 'Harbor ferry arrival', stationId: 'harbor', description: 'Ferry passengers are leaving Old Harbor. Connect the waterfront to the rest of the city.' },
  { name: 'University open day', stationId: 'university', description: 'Extra visitors are heading to University. A second connection can share the load.' },
] as const;
/** Seeded schedule avoids overlapping the established stadium phases. */
export function districtEventAt(elapsed: number, seed: number): DistrictEvent | null {
  if (!Number.isFinite(elapsed) || elapsed < 30) return null;
  const cycle = elapsed < 70 ? 0 : elapsed >= 220 ? 1 + Math.floor((elapsed - 220) / 100) : -1;
  if (cycle < 0) return null;
  const start = cycle === 0 ? 30 : 220 + (cycle - 1) * 100;
  if (elapsed >= start + 40) return null;
  const location = EVENT_LOCATIONS[((seed >>> 0) + cycle) % EVENT_LOCATIONS.length]!;
  return { ...location, id: `${cycle}-${location.stationId}`, start, end: start + 40 };
}
