import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolvePassengersAtStation,
  selectPassengersForBoarding,
} from '../.test-build/simulation/passengerOperations.js';

const passenger = (id, origin, destination, route, extra = {}) => ({
  id,
  origin,
  destination,
  route,
  ...extra,
});

test('boards only passengers whose next route edge matches the train', () => {
  const eligible = passenger(1, 'A', 'C', ['A', 'B', 'C']);
  const wrongDirection = passenger(2, 'A', 'C', ['A', 'D', 'C']);
  const alreadyPastStation = passenger(3, 'A', 'C', ['B', 'C']);

  const result = selectPassengersForBoarding(
    [eligible, wrongDirection, alreadyPastStation],
    'A',
    'B',
    3,
  );

  assert.deepEqual(result.boarding, [eligible]);
  assert.deepEqual(result.waiting, [wrongDirection, alreadyPastStation]);
});

test('boarding respects capacity and keeps eligible passengers in FIFO order', () => {
  const first = passenger(1, 'A', 'D', ['A', 'B', 'D']);
  const second = passenger(2, 'A', 'D', ['A', 'B', 'C', 'D']);
  const third = passenger(3, 'A', 'D', ['A', 'B', 'D']);

  const result = selectPassengersForBoarding([first, second, third], 'A', 'B', 2);

  assert.deepEqual(result.boarding, [first, second]);
  assert.deepEqual(result.waiting, [third]);
});

test('zero, negative and invalid seat counts do not board passengers', () => {
  const item = passenger(1, 'A', 'B', ['A', 'B']);

  for (const seats of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const result = selectPassengersForBoarding([item], 'A', 'B', seats);
    assert.deepEqual(result.boarding, []);
    assert.deepEqual(result.waiting, [item]);
  }
});

test('passengers reaching their destination are delivered', () => {
  const item = passenger(1, 'A', 'B', ['A', 'B']);
  const result = resolvePassengersAtStation([item], 'B', 'C');

  assert.deepEqual(result.delivered, [item]);
  assert.deepEqual(result.continuing, []);
  assert.deepEqual(result.transferring, []);
});

test('passengers continue on board when the next edge is served by the train', () => {
  const item = passenger(1, 'A', 'D', ['A', 'B', 'C', 'D'], { priority: 'standard' });
  const result = resolvePassengersAtStation([item], 'B', 'C');

  assert.equal(result.continuing.length, 1);
  assert.deepEqual(result.continuing[0], {
    id: 1,
    origin: 'A',
    destination: 'D',
    route: ['B', 'C', 'D'],
    priority: 'standard',
  });
  assert.deepEqual(result.transferring, []);
  assert.deepEqual(result.delivered, []);
});

test('passengers change lines when the current train does not serve their next edge', () => {
  const item = passenger(1, 'A', 'D', ['A', 'B', 'E', 'D']);
  const result = resolvePassengersAtStation([item], 'B', 'C');

  assert.deepEqual(result.continuing, []);
  assert.equal(result.transferring.length, 1);
  assert.deepEqual(result.transferring[0]?.route, ['B', 'E', 'D']);
  assert.deepEqual(result.delivered, []);
});

test('passengers only advance their path when the train reaches the expected station', () => {
  const item = passenger(1, 'A', 'D', ['A', 'C', 'D']);
  const result = resolvePassengersAtStation([item], 'B', 'C');

  assert.deepEqual(result.continuing, []);
  assert.deepEqual(result.transferring[0]?.route, ['A', 'C', 'D']);
});

test('arrival resolution never mutates the passenger route supplied by the caller', () => {
  const route = ['A', 'B', 'C'];
  const item = passenger(1, 'A', 'C', route);
  const result = resolvePassengersAtStation([item], 'B', 'C');

  assert.deepEqual(route, ['A', 'B', 'C']);
  assert.deepEqual(result.continuing[0]?.route, ['B', 'C']);
  assert.notEqual(result.continuing[0]?.route, route);
});

test('passengers with no remaining route are delivered rather than left on board', () => {
  const item = passenger(1, 'A', 'Z', ['A', 'B']);
  const result = resolvePassengersAtStation([item], 'B', null);

  assert.deepEqual(result.delivered, [item]);
  assert.deepEqual(result.continuing, []);
  assert.deepEqual(result.transferring, []);
});
