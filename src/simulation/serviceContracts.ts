import type { MetroLine, Station } from './gameTypes.js';
import type { RoutePlanner } from './pathfinding.js';
export const CONTRACTS = [
  { id: 'deliveries', title: 'Servicio fiable', description: 'Transporta 10 personas más en 75 segundos.', reward: 18, target: 10, seconds: 75 },
  { id: 'coverage', title: 'Ciudad conectada', description: 'Conecta 8 estaciones en una misma red antes de 60 segundos.', reward: 14, target: 8, seconds: 60 },
  { id: 'interchange', title: 'Centro de transbordos', description: 'Haz que 3 líneas activas compartan estación antes de 60 segundos.', reward: 12, target: 3, seconds: 60 },
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
  lastResult = 'Elige un contrato. El plazo usa tiempo de simulación; pausa para decidir.';
  accept(id: ContractId, snapshot: ContractSnapshot): boolean {
    if (this.active || this.attempted.has(id) || !CONTRACTS.some(contract => contract.id === id)) return false;
    this.active = { id, started: snapshot.elapsed, baseline: snapshot.score };
    this.attempted.add(id);
    this.lastResult = 'Contrato aceptado. Cumple el objetivo antes de que venza el plazo.';
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
      this.lastResult = `${contract.title}: plazo vencido. Prueba otro contrato o un nuevo turno.`;
      this.active = null; return 0;
    }
    if (this.progress(snapshot) < contract.target) return 0;
    this.completed.add(contract.id);
    this.lastResult = `${contract.title} completado · +$${contract.reward}. Puedes elegir otro contrato.`;
    this.active = null;
    return contract.reward;
  }
  reset(): void { this.active = null; this.completed.clear(); this.attempted.clear(); this.lastResult = 'Elige un contrato. El plazo usa tiempo de simulación; pausa para decidir.'; }
}
