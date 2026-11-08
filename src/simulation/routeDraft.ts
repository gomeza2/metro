import type { MetroLine, Station } from './gameTypes.js';
import { createRoutePlanner } from './pathfinding.js';
import { connectedStationCount } from './serviceContracts.js';

/** An isolated editable route; it never owns or modifies a live fleet. */
export class RouteDraft {
  readonly original: readonly string[];
  stations: string[];
  constructor(readonly lineId: number, route: readonly string[], private readonly available: ReadonlySet<string>) {
    this.original = [...route];
    this.stations = [...route];
  }
  get changed(): boolean { return this.stations.join('\0') !== this.original.join('\0'); }
  select(id: string): boolean {
    if (!this.available.has(id)) return false;
    const index = this.stations.indexOf(id);
    this.stations = index >= 0 ? this.stations.slice(0, index + 1) : [...this.stations, id];
    return true;
  }
  undo(): void { this.stations.pop(); }
  clear(): void { this.stations = []; }
}

export function routeImpact(stations: Station[], lines: MetroLine[], draft: RouteDraft) {
  const live = createRoutePlanner(stations, lines);
  const proposed = createRoutePlanner(stations, lines.map(line => line.id === draft.lineId ? { ...line, stations: [...draft.stations] } : line));
  let disconnected = 0;
  for (const station of stations) {
    disconnected += station.queue.filter(person => person.destination !== station.id && !proposed.findRoute(station.id, person.destination)).length;
  }
  // The edited fleet returns to its recorded last stops when the plan is applied.
  for (const train of lines.find(line => line.id === draft.lineId)?.trains ?? []) {
    disconnected += train.passengers.filter(person => person.destination !== train.lastStationId && !proposed.findRoute(train.lastStationId, person.destination)).length;
  }
  const coverage = (planner: typeof live) => {
    const count = connectedStationCount(stations.filter(station => station.active !== false), planner);
    return count < 2 ? 0 : count;
  };
  return { before: coverage(live), after: coverage(proposed), disconnected };
}
