import type { MetroLine, Station } from './gameTypes.js';
export const MAX_LINE_STOPS = 6;
export const TRACK_PACK = 5;
export const MAX_TRACK_PACKS = 6;
export class ConstructionBudget {
  packs = 0;
  get cost(): number { return 16 + this.packs * 8; }
  capacity(activeStations: number): number {
    return (activeStations <= 3 ? 9 : activeStations <= 6 ? 16 : activeStations <= 10 ? 24 : 30) + this.packs * TRACK_PACK;
  }
  expand(budget: { credits: number }): boolean {
    if (this.packs >= MAX_TRACK_PACKS || !Number.isFinite(budget.credits) || budget.credits < this.cost) return false;
    budget.credits -= this.cost; this.packs += 1; return true;
  }
  reset(): void { this.packs = 0; }
}
/** Each line needs its own track. Shorter routes release material immediately. */
export function constructionQuote(stations: readonly Station[], lines: readonly MetroLine[], lineId: number, route: readonly string[], capacity: number) {
  const lookup = new Map(stations.map(station => [station.id, station]));
  if (Number.isNaN(capacity) || capacity < 0) return { used: 0, capacity, remaining: 0, ok: false, reason: 'track' as const };
  let used = 0;
  for (const line of lines) {
    const stops = line.id === lineId ? route : line.stations;
    if (stops.some(id => !lookup.has(id))) return { used: Infinity, capacity, remaining: 0, ok: false, reason: 'station' as const };
    for (let index = 1; index < stops.length; index++) {
      const from = lookup.get(stops[index - 1]!), to = lookup.get(stops[index]!);
      if (!from || !to) return { used: Infinity, capacity, remaining: 0, ok: false, reason: 'station' as const };
      used += Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 80));
    }
  }
  const reason = Number.isFinite(capacity) && route.length > MAX_LINE_STOPS ? 'stops' : used > capacity ? 'track' : null;
  return { used, capacity, remaining: Math.max(0, capacity - used), ok: reason === null, reason };
}
