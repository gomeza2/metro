import type { MetroLine, Station } from './gameTypes.js';
import type { RoutePlanner } from './pathfinding.js';
export const CONTRACTS = [
  { id: 'deliveries', title: 'Reliable service', description: 'Deliver 10 more passengers in 75 seconds.', reward: 18, target: 10, seconds: 75 },
  { id: 'coverage', title: 'Citywide access', description: 'Connect 8 stations in one network within 60 seconds.', reward: 14, target: 8, seconds: 60 },
  { id: 'interchange', title: 'Transfer hub', description: 'Serve one station with 3 active lines within 60 seconds.', reward: 12, target: 3, seconds: 60 },
] as const;
export type ContractId = typeof CONTRACTS[number]['id'];
export function connectedStationCount(stations: readonly Station[], planner: RoutePlanner): number {
  return Math.max(0, ...stations.map(from => stations.filter(to => planner.findRoute(from.id, to.id) !== null).length));
}
export type ContractSnapshot = { elapsed: number; score: number; stations: Station[]; lines: MetroLine[]; planner: RoutePlanner };
export class ServiceContracts {
  active: { id: ContractId; started: number; baseline: number } | null = null;
  readonly completed = new Set<ContractId>();
  readonly attempted = new Set<ContractId>();
  lastResult = 'Choose one grant. The deadline uses simulation time; pause to plan.';
  accept(id: ContractId, snapshot: ContractSnapshot): boolean {
    if (this.active || this.attempted.has(id) || !CONTRACTS.some(contract => contract.id === id)) return false;
    this.active = { id, started: snapshot.elapsed, baseline: snapshot.score };
    this.attempted.add(id);
    this.lastResult = 'Grant accepted. Complete the service requirement before the deadline.';
    return true;
  }
  progress(snapshot: ContractSnapshot): number {
    if (!this.active) return 0;
    switch (this.active.id) {
      case 'deliveries': return Math.max(0, snapshot.score - this.active.baseline);
      case 'coverage': return connectedStationCount(snapshot.stations, snapshot.planner);
      case 'interchange': return Math.max(0, ...snapshot.stations.map(station => snapshot.lines.filter(line => line.stations.length >= 2 && line.stations.includes(station.id)).length));
    }
  }
  step(snapshot: ContractSnapshot): number {
    if (!this.active) return 0;
    const contract = CONTRACTS.find(item => item.id === this.active!.id)!;
    // The deadline is exclusive: completing on or after it is too late.
    if (snapshot.elapsed >= this.active.started + contract.seconds) {
      this.lastResult = `${contract.title}: deadline missed. Try a different grant or a new shift.`;
      this.active = null; return 0;
    }
    if (this.progress(snapshot) < contract.target) return 0;
    this.completed.add(contract.id);
    this.lastResult = `${contract.title} complete · +$${contract.reward}. Choose another grant.`;
    this.active = null;
    return contract.reward;
  }
  reset(): void { this.active = null; this.completed.clear(); this.attempted.clear(); this.lastResult = 'Choose one grant. The deadline uses simulation time; pause to plan.'; }
}
