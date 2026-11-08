import type { GameSimulationState } from './gameSimulation.js';
/** One owner for mutable run counters; restart cannot leave a counter behind. */
export class RunState implements GameSimulationState {
  passengerId = 1;
  elapsed = 0;
  demandClock = 0;
  score = 0;
  credits = 28;
  stadiumArrivalsDelivered = 0;
  stadiumDeparturesDelivered = 0;
  reset(startingCredits = 28): void {
    this.passengerId = 1;
    this.elapsed = 0;
    this.demandClock = 0;
    this.score = 0;
    this.credits = startingCredits;
    this.stadiumArrivalsDelivered = 0;
    this.stadiumDeparturesDelivered = 0;
  }
}
