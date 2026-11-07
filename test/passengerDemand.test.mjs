import test from 'node:test';
import assert from 'node:assert/strict';
import { passengerTripWeight, selectPassengerTrip } from '../.test-build/simulation/passengerDemand.js';

const endpoint = (id, kind, queueLength = 0) => ({ id, kind, queueLength });
const candidate = (from, to, payload = null) => ({
  from,
  to,
  route: [from.id, to.id],
  payload,
});

test('morning demand favors residential departures toward work and civic districts', () => {
  const trip = candidate(endpoint('north', 'residential'), endpoint('market', 'commerce'));
  const weight = passengerTripWeight(trip, { elapsed: 20, hour: 8 });

  assert.equal(weight, 2.7 * 1.7 * 1.8 * 1.35);
});

test('event preparation increases trips into the stadium and discourages exits', () => {
  const inbound = candidate(endpoint('civic', 'civic'), endpoint('stadium', 'leisure'));
  const outbound = candidate(endpoint('stadium', 'leisure'), endpoint('market', 'commerce'));
  const context = { elapsed: 80, hour: 12 };

  assert.equal(passengerTripWeight(inbound, context), 3.4);
  assert.equal(passengerTripWeight(outbound, context), 0.12);
});

test('the live event creates a stronger inbound stadium pulse', () => {
  const inbound = candidate(endpoint('north', 'residential'), endpoint('stadium', 'leisure'));
  assert.equal(passengerTripWeight(inbound, { elapsed: 120, hour: 12 }), 7.2);
});

test('the return phase favors passengers leaving the stadium for residential areas', () => {
  const returning = candidate(endpoint('stadium', 'leisure'), endpoint('east', 'residential'));
  assert.equal(passengerTripWeight(returning, { elapsed: 180, hour: 12 }), 8.4 * 1.4);
});

test('the late shift builds return trips toward residential districts', () => {
  const returning = candidate(endpoint('market', 'commerce'), endpoint('north', 'residential'));
  assert.equal(passengerTripWeight(returning, { elapsed: 240, hour: 15 }), 1.55 * 2.1);
});

test('selection prefers origins with shorter queues when they are available', () => {
  const crowded = candidate(endpoint('market', 'commerce', 13), endpoint('clinic', 'civic'), 'crowded');
  const clear = candidate(endpoint('north', 'residential', 2), endpoint('market', 'commerce'), 'clear');

  const selected = selectPassengerTrip([crowded, clear], { elapsed: 240, hour: 15 }, () => 0.999);

  assert.equal(selected?.payload, 'clear');
});

test('weighted selection can be reproduced using an injected random source', () => {
  const first = candidate(endpoint('a', 'commerce'), endpoint('b', 'leisure'), 'first');
  const second = candidate(endpoint('c', 'commerce'), endpoint('d', 'leisure'), 'second');
  const context = { elapsed: 70, hour: 12 };

  assert.equal(selectPassengerTrip([first, second], context, () => 0)?.payload, 'first');
  assert.equal(selectPassengerTrip([first, second], context, () => 0.999)?.payload, 'second');
});

test('random values at the boundaries stay within the candidate pool', () => {
  const first = candidate(endpoint('a', 'commerce'), endpoint('b', 'leisure'), 'first');
  const second = candidate(endpoint('c', 'commerce'), endpoint('d', 'leisure'), 'second');
  const context = { elapsed: 70, hour: 12 };

  assert.equal(selectPassengerTrip([first, second], context, () => 1)?.payload, 'second');
  assert.equal(selectPassengerTrip([first, second], context, () => -1)?.payload, 'first');
});

test('empty candidate pools or invalid random samples return null', () => {
  assert.equal(selectPassengerTrip([], { elapsed: 0, hour: 8 }), null);
  const trip = candidate(endpoint('a', 'commerce'), endpoint('b', 'leisure'));
  assert.equal(selectPassengerTrip([trip], { elapsed: 0, hour: 8 }, () => Number.NaN), null);
});
