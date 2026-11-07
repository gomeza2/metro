import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoutePlanner } from '../.test-build/simulation/pathfinding.js';

const stations = (ids) => ids.map((id) => ({ id }));

test('routes are built in both directions along metro lines', () => {
  const planner = createRoutePlanner(stations(['A', 'B', 'C']), [
    { stations: ['A', 'B', 'C'] },
  ]);

  assert.deepEqual(planner.findRoute('A', 'C'), ['A', 'B', 'C']);
  assert.deepEqual(planner.findRoute('C', 'A'), ['C', 'B', 'A']);
});

test('chooses the route with the fewest stops across interchanges', () => {
  const planner = createRoutePlanner(stations(['A', 'B', 'C', 'D', 'E']), [
    { stations: ['A', 'B', 'C', 'D'] },
    { stations: ['A', 'E', 'D'] },
  ]);

  assert.deepEqual(planner.findRoute('A', 'D'), ['A', 'E', 'D']);
});

test('returns null when stations are disconnected or unknown', () => {
  const planner = createRoutePlanner(stations(['A', 'B', 'C']), [
    { stations: ['A', 'B'] },
  ]);

  assert.equal(planner.findRoute('A', 'C'), null);
  assert.equal(planner.findRoute('missing', 'A'), null);
  assert.equal(planner.findRoute('A', 'missing'), null);
});

test('handles loops without visiting a station twice', () => {
  const planner = createRoutePlanner(stations(['A', 'B', 'C', 'D']), [
    { stations: ['A', 'B', 'C', 'A'] },
    { stations: ['C', 'D'] },
  ]);

  const route = planner.findRoute('A', 'D');
  assert.deepEqual(route, ['A', 'C', 'D']);
  assert.equal(new Set(route).size, route.length);
});

test('returns independent arrays so a passenger cannot mutate the route cache', () => {
  const planner = createRoutePlanner(stations(['A', 'B', 'C']), [
    { stations: ['A', 'B', 'C'] },
  ]);

  const passengerRoute = planner.findRoute('A', 'C');
  passengerRoute?.shift();

  assert.deepEqual(planner.findRoute('A', 'C'), ['A', 'B', 'C']);
});

test('planner is a snapshot and does not change when source route arrays are edited', () => {
  const line = { stations: ['A', 'B'] };
  const planner = createRoutePlanner(stations(['A', 'B', 'C']), [line]);

  line.stations.push('C');

  assert.equal(planner.findRoute('A', 'C'), null);
});
