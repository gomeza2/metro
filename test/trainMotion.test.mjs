import test from 'node:test';
import assert from 'node:assert/strict';
import { directionForStation, nextStopIndex } from '../.test-build/simulation/trainMotion.js';

test('a train at the first station travels into the route', () => {
  assert.equal(directionForStation(0, -1, 4), 1);
  assert.equal(nextStopIndex(0, -1, 4), 1);
});

test('a train at the last station travels back into the route', () => {
  assert.equal(directionForStation(3, 1, 4), -1);
  assert.equal(nextStopIndex(3, 1, 4), 2);
});

test('a train between endpoints keeps its current direction', () => {
  assert.equal(directionForStation(2, -1, 4), -1);
  assert.equal(nextStopIndex(2, -1, 4), 1);
});

test('single-stop routes and invalid station indices have no next stop', () => {
  assert.equal(nextStopIndex(0, 1, 1), null);
  assert.equal(nextStopIndex(-1, 1, 4), null);
  assert.equal(nextStopIndex(4, -1, 4), null);
  assert.equal(nextStopIndex(1.5, 1, 4), null);
});
