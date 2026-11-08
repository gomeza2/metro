import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoutePlanner } from '../.test-build/simulation/pathfinding.js';
import { GameSimulation } from '../.test-build/simulation/gameSimulation.js';

function station(id, x, queue = []) {
  return { id, name: id, x, y: 0, kind: 'residential', queue, overload: 0 };
}

function passenger(id, origin, destination, route) {
  return { id, origin, destination, route };
}

function train(overrides = {}) {
  return {
    id: 1,
    lastStationId: 'A',
    stationIndex: 0,
    direction: 1,
    progress: 0,
    dwell: 10,
    passengers: [],
    ...overrides,
  };
}

function createGame({ queueA = [], passengers = [], dwell = 10, overload = 0, running = true, secondStationId = 'B', plan = 'standard', seed } = {}) {
  const a = station('A', 0, queueA);
  const b = station(secondStationId, 10);
  const c = station('C', 20);
  a.overload = overload;
  const vehicle = train({ dwell, passengers });
  const line = {
    id: 0,
    name: 'Line 1',
    color: '#e47762',
    stations: ['A', secondStationId],
    trains: [vehicle],
    fleetSize: 1,
  };
  const stations = [a, b, c];
  const lines = [line];
  const state = {
    passengerId: 1,
    elapsed: 0,
    demandClock: 0,
    score: 0,
    credits: 28,
    stadiumArrivalsDelivered: 0,
    stadiumDeparturesDelivered: 0,
  };
  const planner = createRoutePlanner(stations, lines);
  let active = running;
  let overloadStation = null;
  const simulation = new GameSimulation({
    stations,
    lines,
    state,
    getRoutePlanner: () => planner,
    isRunning: () => active,
    getCapacityLevel: () => 1,
    getExpressLevel: () => 1,
    onOverload: (overflowingStation) => {
      overloadStation = overflowingStation;
      active = false;
    },
    random: () => 0,
    getServicePlan: () => plan,
    ...(seed === undefined ? {} : { getEventSeed: () => seed }),
  });

  return {
    simulation,
    stations,
    line,
    vehicle,
    state,
    overloadStation: () => overloadStation,
    setRunning: (value) => { active = value; },
  };
}

test('does not advance while the menu, pause or game-over state blocks the run', () => {
  const game = createGame({ running: false });
  game.simulation.step(1 / 60);
  assert.equal(game.state.elapsed, 0);
  assert.equal(game.state.demandClock, 0);
});

test('ignores invalid or non-positive time deltas', () => {
  const game = createGame();
  game.simulation.step(0);
  game.simulation.step(-1);
  game.simulation.step(Number.NaN);
  assert.equal(game.state.elapsed, 0);
  assert.equal(game.state.demandClock, 0);
});

test('spawns passengers only along connected paths and advances their IDs', () => {
  const game = createGame();
  game.simulation.step(5.2);

  assert.equal(game.state.elapsed, 5.2);
  assert.equal(game.state.passengerId, 2);
  assert.equal(game.stations[0].queue.length, 1);
  assert.deepEqual(game.stations[0].queue[0].route, ['A', 'B']);
  assert.equal(game.stations[2].queue.length, 0);
});

test('boards passengers when a train finishes its dwell at a matching station', () => {
  const waiting = passenger(1, 'A', 'B', ['A', 'B']);
  const game = createGame({ queueA: [waiting], dwell: 0.05 });
  game.simulation.step(0.05);

  assert.equal(game.stations[0].queue.length, 0);
  assert.equal(game.vehicle.passengers.length, 1);
  assert.equal(game.vehicle.passengers[0].id, 1);
  assert.equal(game.vehicle.dwell, 0);
});

test('delivers passengers on arrival and updates score, funds and stadium counters', () => {
  const arriving = passenger(7, 'A', 'B', ['A', 'B']);
  const game = createGame({ passengers: [arriving], dwell: 0 });
  game.simulation.step(0.1);

  assert.equal(game.vehicle.stationIndex, 1);
  assert.equal(game.vehicle.passengers.length, 0);
  assert.equal(game.state.score, 1);
  assert.equal(game.state.credits, 30);
});

test('tracks passengers delivered to the stadium', () => {
  const inbound = passenger(1, 'A', 'stadium', ['A', 'stadium']);
  const game = createGame({ passengers: [inbound], dwell: 0, secondStationId: 'stadium' });
  game.simulation.step(0.1);

  assert.equal(game.state.stadiumArrivalsDelivered, 1);
  assert.equal(game.state.score, 1);
});

test('tracks passengers returning from the stadium', () => {
  const outbound = passenger(2, 'stadium', 'B', ['A', 'B']);
  const game = createGame({ passengers: [outbound], dwell: 0 });
  game.simulation.step(0.1);

  assert.equal(game.state.stadiumDeparturesDelivered, 1);
  assert.equal(game.state.score, 1);
});

test('signals an overload once the queue stays above its limit long enough', () => {
  const queue = Array.from({ length: 13 }, (_, index) => passenger(index + 1, 'A', 'B', ['A', 'B']));
  const game = createGame({ queueA: queue, overload: 16.9 });
  game.simulation.step(0.2);

  assert.equal(game.overloadStation()?.id, 'A');
  assert.ok(game.stations[0].overload >= 17);
  game.simulation.step(1);
  assert.equal(game.overloadStation()?.id, 'A');
});

test('reduces overload pressure while a station queue is below the warning limit', () => {
  const game = createGame({ overload: 4 });
  game.simulation.step(1);
  assert.equal(game.stations[0].overload, 3.3);
});


test('rush generates demand earlier and relaxed demand leaves more planning time', () => {
  const normal = createGame(), rush = createGame({plan: 'rush'}), relaxed = createGame({plan: 'relaxed'});
  for (const game of [normal,rush,relaxed]) game.simulation.step(4);
  assert.equal(rush.state.passengerId,2);assert.equal(normal.state.passengerId,1);assert.equal(relaxed.state.passengerId,1);
});
test('sandbox retains queues but cannot lose to overload; rush has a shorter rescue window', () => {
  const queue=Array.from({length:13},(_,i)=>passenger(i,'A','B',['A','B']));
  const sandbox=createGame({plan:'sandbox',queueA:queue,overload:20});sandbox.simulation.step(1/60);
  assert.equal(sandbox.overloadStation(),null);assert.ok(sandbox.stations[0].queue.length>=13);
  const rush=createGame({plan:'rush',queueA:queue,overload:12});rush.simulation.step(1/60);assert.equal(rush.overloadStation().id,'A');
});
