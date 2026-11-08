import { OPERATING_POLICIES, POLICY_CHANGE_COST, type OperatingPolicyId } from './operatingPolicies.js';
import { createRoutePlanner, type RoutePlanner } from './pathfinding.js';
import type { MetroLine, Station, Train } from './gameTypes.js';

export const REASSIGNMENT_COST = 4;
export const dispatchCost = (line: MetroLine): number => 18 + Math.max(0, line.fleetSize - 1) * 16;
export type RouteEditResult = 'extended' | 'trimmed' | 'unchanged' | 'invalid';

/** Owns topology changes, fleet placement and the planner snapshot as one operation. */
export class NetworkCommands {
  planner: RoutePlanner;
  private trainSequence = 1;
  private readonly stationById: Map<string, Station>;

  constructor(private readonly stations: Station[], private readonly lines: MetroLine[], private readonly canBuild: (lineId: number, route: readonly string[]) => boolean = () => true) {
    this.stationById = new Map(stations.map(station => [station.id, station]));
    this.planner = createRoutePlanner(stations, lines);
  }

  selectStation(lineId: number, stationId: string): RouteEditResult {
    const line = this.lines.find(item => item.id === lineId);
    if (!line || !this.stationById.has(stationId) || this.stationById.get(stationId)?.active === false) return 'invalid';
    const index = line.stations.indexOf(stationId);
    if (index === line.stations.length - 1 && index >= 0) return 'unchanged';
    const route = index >= 0 ? line.stations.slice(0, index + 1) : [...line.stations, stationId];
    if (!this.canBuild(lineId, route)) return 'invalid';
    line.stations = route;
    this.rebuild(line);
    return index >= 0 ? 'trimmed' : 'extended';
  }

  replaceRoute(lineId: number, route: readonly string[]): RouteEditResult {
    const line = this.lines.find(item => item.id === lineId);
    if (!line || new Set(route).size !== route.length || route.some(id => !this.stationById.has(id) || this.stationById.get(id)?.active === false)) return 'invalid';
    if (line.stations.join('\0') === route.join('\0')) return 'unchanged';
    if (!this.canBuild(lineId, route)) return 'invalid';
    line.stations = [...route];
    this.rebuild(line);
    return 'extended';
  }

  undo(lineId: number): boolean {
    const line = this.lines.find(item => item.id === lineId);
    if (!line?.stations.length) return false;
    line.stations.pop();
    this.rebuild(line);
    return true;
  }

  clear(lineId: number): boolean {
    const line = this.lines.find(item => item.id === lineId);
    if (!line?.stations.length) return false;
    line.stations = [];
    this.rebuild(line);
    return true;
  }

  dispatch(lineId: number, budget: { credits: number }): boolean {
    const line = this.lines.find(item => item.id === lineId);
    if (!line || line.stations.length < 2 || line.fleetSize >= 3 || !Number.isFinite(budget.credits) || budget.credits < dispatchCost(line)) return false;
    const cost = dispatchCost(line);
    const train = this.spacedTrain(line);
    budget.credits -= cost;
    line.trains.push(train);
    line.fleetSize += 1;
    return true;
  }

  /** The least occupied extra train returns riders to its last actual stop. */
  reassignmentPreview(fromId: number, toId: number): { trainId: number | null; passengers: number; stationId: string | null } | null {
    const source = this.lines.find(line => line.id === fromId);
    const target = this.lines.find(line => line.id === toId);
    if (!source || !target || source === target || source.fleetSize <= 1 || target.fleetSize >= 3 || target.stations.length < 2) return null;
    if (target.stations.some(id => !this.stationById.has(id) || this.stationById.get(id)?.active === false)) return null;
    const train = source.trains.reduce<Train | null>((best, item) => !best || item.passengers.length < best.passengers.length ? item : best, null);
    if (train && !this.stationById.has(train.lastStationId)) return null;
    return { trainId: train?.id ?? null, passengers: train?.passengers.length ?? 0, stationId: train?.lastStationId ?? null };
  }

  reassign(fromId: number, toId: number, budget: { credits: number }): boolean {
    const preview = this.reassignmentPreview(fromId, toId);
    if (!preview || !Number.isFinite(budget.credits) || budget.credits < REASSIGNMENT_COST) return false;
    const source = this.lines.find(line => line.id === fromId)!;
    const target = this.lines.find(line => line.id === toId)!;
    const train = source.trains.find(item => item.id === preview.trainId);
    const replacement = this.spacedTrain(target);
    if (train) {
      const station = this.stationById.get(train.lastStationId)!;
      for (const passenger of train.passengers) {
        passenger.route = [...(this.planner.findRoute(station.id, passenger.destination) ?? [])];
        station.queue.push(passenger);
      }
      train.passengers = [];
      source.trains = source.trains.filter(item => item !== train);
      replacement.id = train.id;
    }
    source.fleetSize -= 1;
    target.fleetSize += 1;
    target.trains.push(replacement);
    budget.credits -= REASSIGNMENT_COST;
    return true;
  }

  setPolicy(lineId: number, policy: OperatingPolicyId, budget: { credits: number }): boolean {
    const line = this.lines.find(item => item.id === lineId);
    if (!line || !Object.hasOwn(OPERATING_POLICIES, policy) || (line.policy ?? 'balanced') === policy) return false;
    const cost = line.stations.length >= 2 ? POLICY_CHANGE_COST : 0;
    if (!Number.isFinite(budget.credits) || budget.credits < cost) return false;
    budget.credits -= cost;
    line.policy = policy;
    return true;
  }

  reset(): void {
    for (const station of this.stations) { station.queue = []; station.overload = 0; station.platformLevel = 0; }
    for (const line of this.lines) { line.stations = []; line.trains = []; line.fleetSize = 1; line.policy = 'balanced'; }
    this.trainSequence = 1;
    this.planner = createRoutePlanner(this.stations, this.lines);
  }

  private createTrain(line: MetroLine, index: number, direction: 1 | -1, dwell = 0.7): Train {
    const stationId = line.stations[index];
    if (!stationId) throw new Error('A train requires a valid route station.');
    return { id: this.trainSequence++, lastStationId: stationId, stationIndex: index, direction, progress: 0, dwell, passengers: [], policy: line.policy ?? 'balanced' };
  }

  private spacedTrain(line: MetroLine): Train {
    let bestIndex = 0;
    let bestSpacing = -1;
    for (let index = 0; index < line.stations.length; index += 1) {
      const spacing = line.trains.length
        ? Math.min(...line.trains.map(train => Math.abs(index - (train.stationIndex + train.direction * train.progress))))
        : line.stations.length;
      if (spacing > bestSpacing) { bestIndex = index; bestSpacing = spacing; }
    }
    return this.createTrain(line, bestIndex, bestIndex === line.stations.length - 1 ? -1 : 1, 1.1);
  }

  private rebuild(line: MetroLine): void {
    // Return all riders before replacing an edited fleet. Never discard people with a route.
    for (const train of line.trains) {
      const station = this.stationById.get(train.lastStationId);
      if (!station) throw new Error('Cannot edit a fleet with an unknown last station.');
      station.queue.push(...train.passengers);
    }
    line.trains = [];
    if (line.stations.length >= 2) {
      line.trains.push(this.createTrain(line, 0, 1));
      while (line.trains.length < line.fleetSize) line.trains.push(this.spacedTrain(line));
    }
    this.planner = createRoutePlanner(this.stations, this.lines);
    for (const station of this.stations) {
      for (const passenger of station.queue) {
        passenger.route = [...(this.planner.findRoute(station.id, passenger.destination) ?? [])];
      }
    }
    // Riders on other lines stay aboard. The engine replans them at their next arrival.
  }
}
