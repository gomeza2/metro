export type OperatingIncident = { id: string; stationId: string; start: number; end: number; speed: number };
const STATIONS = ['museum', 'civic', 'harbor'] as const;
export function incidentAt(elapsed: number, seed: number, enabled: boolean): OperatingIncident | null {
  if (!enabled || !Number.isFinite(elapsed) || elapsed < 100) return null;
  const cycle = Math.floor((elapsed - 100) / 120);
  const start = 100 + cycle * 120;
  if (elapsed >= start + 30) return null;
  const stationId = STATIONS[((seed >>> 0) + cycle) % STATIONS.length]!;
  return { id: `${cycle}-${stationId}`, stationId, start, end: start + 30, speed: 0.65 };
}
export function approachingIncident(elapsed: number, seed: number, enabled: boolean): OperatingIncident | null {
  if (!enabled || !Number.isFinite(elapsed)) return null;
  const next = incidentAt(elapsed + 15, seed, enabled);
  return next && elapsed < next.start ? next : null;
}
