import { incidentAt } from './operatingIncidents.js';
import { OPERATING_POLICIES, trainSeats, trainSpeed } from './operatingPolicies.js';
import { stationQueueLimit } from './stationCapacity.js';
import type { RunEconomy } from './runEconomy.js';
import { districtEventAt, SERVICE_PLANS, type ServicePlanId } from './servicePlans.js';
import type { RoutePlanner } from './pathfinding.js';
import {
  selectPassengerTrip,
  type PassengerTripCandidate,
} from './passengerDemand.js';
import {
  resolvePassengersAtStation,
  selectPassengersForBoarding,
} from './passengerOperations.js';
import { directionForStation, nextStopIndex } from './trainMotion.js';
import type { MetroLine, Passenger, Station, Train } from './gameTypes.js';

export interface GameSimulationState {
  passengerId: number;
  elapsed: number;
  demandClock: number;
  score: number;
  credits: number;
  stadiumArrivalsDelivered: number;
  stadiumDeparturesDelivered: number;
}

export interface GameSimulationOptions {
  stations: Station[];
  lines: MetroLine[];
  state: GameSimulationState;
  getRoutePlanner: () => RoutePlanner;
  isRunning: () => boolean;
  getCapacityLevel: () => number;
  getExpressLevel: () => number;
  onOverload: (station: Station) => void;
  random?: () => number;
  getServicePlan?: () => ServicePlanId;
  getEventSeed?: () => number;
  getIncidentsEnabled?: () => boolean;
  economy?: RunEconomy;
  onPhaseReward?: (reward: number) => void;
}

/**
 * Owns the live, DOM-free gameplay update.
 *
 * The browser layer supplies the current network snapshot, mutable run state,
 * upgrade levels and two presentation boundary callbacks. The simulation can
 * advance passengers and trains without reading or writing any HTML or Canvas.
 */
export class GameSimulation {
  private readonly stationById: Map<string, Station>;
  private readonly random: () => number;

  constructor(private readonly options: GameSimulationOptions) {
    this.stationById = new Map(options.stations.map((station) => [station.id, station]));
    this.random = options.random ?? Math.random;
  }

  step(dt: number): void {
    const { stations, lines, state } = this.options;
    if (!Number.isFinite(dt) || dt <= 0 || !this.options.isRunning()) return;
    if (!lines.some((line) => line.stations.length >= 2)) return;

    state.elapsed += dt;
    state.demandClock += dt;

    const plan = SERVICE_PLANS[this.options.getServicePlan?.() ?? 'standard'];
    const spawnInterval = Math.max(1.7, 5.2 - state.elapsed / 150) / plan.demand;
    while (state.demandClock >= spawnInterval) {
      state.demandClock -= spawnInterval;
      this.spawnPassenger();
      if (state.elapsed > 90 && this.random() < 0.22) this.spawnPassenger();
    }

    const incident = incidentAt(state.elapsed, this.options.getEventSeed?.() ?? 0, this.options.getIncidentsEnabled?.() ?? false);
    for (const line of lines) {
      if (line.stations.length < 2) continue;

      for (const train of line.trains) {
        this.normalizeTrainDirection(line, train);

        if (train.dwell > 0) {
          train.dwell = Math.max(0, train.dwell - dt);
          if (train.dwell === 0) {
            const currentId = line.stations[train.stationIndex];
            const current = currentId ? this.stationById.get(currentId) : undefined;
            if (current) this.boardPassengers(line, train, current);
          }
          continue;
        }

        const currentId = line.stations[train.stationIndex];
        const current = currentId ? this.stationById.get(currentId) : undefined;
        const next = this.nextTrainStop(line, train);
        if (!current || !next) continue;

        const distance = Math.hypot(next.x - current.x, next.y - current.y);
        const affected = incident && (incident.stationId === current.id || incident.stationId === next.id);
        const travelUnitsPerSecond = trainSpeed(this.options.getExpressLevel(), train.policy ?? line.policy ?? 'balanced') * (affected ? incident.speed : 1);
        train.progress += (dt * travelUnitsPerSecond) / Math.max(1, distance);

        if (train.progress >= 1) {
          train.stationIndex += train.direction;
          train.lastStationId = next.id;
          train.progress = 0;
          train.dwell = 0.45;
          this.arriveAtStation(line, train, next);
          train.dwell = OPERATING_POLICIES[train.policy ?? 'balanced'].dwell;
        }
      }
    }

    let overloadHandled = false;
    for (const station of stations) {
      if (station.queue.length > stationQueueLimit(station)) station.overload += dt;
      else station.overload = Math.max(0, station.overload - dt * 0.7);

      if (station.overload >= plan.overloadSeconds && !overloadHandled) {
        overloadHandled = true;
        this.options.onOverload(station);
      }
    }
    if (!overloadHandled) {
      const reward = this.options.economy?.awardPhase(state, lines) ?? 0;
      if (reward) this.options.onPhaseReward?.(reward);
    }
  }

  private spawnPassenger(): void {
    const { stations, state } = this.options;
    const planner = this.options.getRoutePlanner();
    const connected: PassengerTripCandidate<Station>[] = [];

    for (const from of stations) {
      if (from.active === false) continue;
      if (from.queue.length >= stationQueueLimit(from) + 4) continue;

      for (const to of stations) {
        if (to.active === false) continue;
        if (from.id === to.id || to.queue.length >= stationQueueLimit(to) + 4) continue;
        const route = planner.findRoute(from.id, to.id);
        if (!route || route.length < 2) continue;

        connected.push({
          from: { id: from.id, kind: from.kind, queueLength: from.queue.length },
          to: { id: to.id, kind: to.kind, queueLength: to.queue.length },
          route,
          payload: from,
        });
      }
    }

    const hour = Math.floor((8 * 60 + Math.floor(state.elapsed * 2.2)) / 60) % 24;
    const selected = selectPassengerTrip(
      connected,
      { elapsed: state.elapsed, hour, event: this.options.getEventSeed ? districtEventAt(state.elapsed, this.options.getEventSeed()) : null },
      this.random,
    );
    if (!selected) return;

    const passenger: Passenger = {
      id: state.passengerId,
      origin: selected.from.id,
      destination: selected.to.id,
      route: [...selected.route],
    };
    state.passengerId += 1;
    selected.payload.queue.push(passenger);
  }

  private normalizeTrainDirection(line: MetroLine, train: Train): void {
    train.direction = directionForStation(train.stationIndex, train.direction, line.stations.length);
  }

  private nextTrainStop(line: MetroLine, train: Train): Station | null {
    const targetIndex = nextStopIndex(train.stationIndex, train.direction, line.stations.length);
    const id = targetIndex === null ? undefined : line.stations[targetIndex];
    return id ? this.stationById.get(id) ?? null : null;
  }

  private boardPassengers(line: MetroLine, train: Train, station: Station): void {
    const next = this.nextTrainStop(line, train);
    if (!next) return;

    // A policy is adopted at a station, never halfway through a leg. Existing
    // riders keep their seats even if the new policy has a lower capacity.
    train.policy = line.policy ?? 'balanced';
    const availableSeats = trainSeats(this.options.getCapacityLevel(), train.policy) - train.passengers.length;
    const result = selectPassengersForBoarding(
      station.queue,
      station.id,
      next.id,
      availableSeats,
    );
    if (!result.boarding.length) return;

    station.queue = result.waiting;
    train.passengers.push(...result.boarding);
  }

  private arriveAtStation(line: MetroLine, train: Train, station: Station): void {
    this.normalizeTrainDirection(line, train);
    const next = this.nextTrainStop(line, train);
    // Another line may have changed while this train was in transit. Replan
    // from the actual arrival, never deliver somebody merely because a path vanished.
    const arriving: Passenger[] = [];
    for (const passenger of train.passengers) {
      const route = this.options.getRoutePlanner().findRoute(station.id, passenger.destination);
      if (!route && passenger.destination !== station.id) {
        station.queue.push({ ...passenger, route: [] });
      } else {
        arriving.push({ ...passenger, route: [station.id, ...(route ?? [station.id])] });
      }
    }
    const result = resolvePassengersAtStation(
      arriving,
      station.id,
      next?.id ?? null,
    );

    const { state } = this.options;
    for (const passenger of result.delivered) {
      state.score += 1;
      state.credits += 2;
      if (passenger.destination === 'stadium') state.stadiumArrivalsDelivered += 1;
      if (passenger.origin === 'stadium' && passenger.destination === station.id) {
        state.stadiumDeparturesDelivered += 1;
      }
    }

    if (result.transferring.length) station.queue.push(...result.transferring);
    train.passengers = result.continuing;
    this.boardPassengers(line, train, station);
  }
}
