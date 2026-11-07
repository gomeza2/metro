import test from 'node:test';
import assert from 'node:assert/strict';
import { getShiftPhase, getShiftPhaseIndex, SHIFT_PHASES } from '../.test-build/simulation/shiftPhases.js';

test('the shift has exactly five ordered phases with contiguous boundaries', () => {
  assert.equal(SHIFT_PHASES.length, 5);
  assert.deepEqual(
    SHIFT_PHASES.slice(1).map((phase, index) => phase.start - SHIFT_PHASES[index].end),
    [0, 0, 0, 0],
  );
});

test('the opening phase includes time zero and ends immediately before 70', () => {
  assert.equal(getShiftPhase(0).id, 'morning-network');
  assert.equal(getShiftPhase(69.999).id, 'morning-network');
  assert.equal(getShiftPhaseIndex(69.999), 0);
});

test('the stadium preparation phase begins exactly at 70 and ends before 100', () => {
  assert.equal(getShiftPhase(70).id, 'stadium-preparation');
  assert.equal(getShiftPhase(99.999).id, 'stadium-preparation');
  assert.equal(getShiftPhaseIndex(99.999), 1);
});

test('the stadium arrival phase begins exactly at 100 and ends before 160', () => {
  assert.equal(getShiftPhase(100).id, 'stadium-arrival');
  assert.equal(getShiftPhase(159.999).id, 'stadium-arrival');
  assert.equal(getShiftPhaseIndex(159.999), 2);
});

test('the post-event return phase begins exactly at 160 and ends before 205', () => {
  assert.equal(getShiftPhase(160).id, 'post-event-return');
  assert.equal(getShiftPhase(204.999).id, 'post-event-return');
  assert.equal(getShiftPhaseIndex(204.999), 3);
});

test('the afternoon commute phase begins exactly at 205 and remains active afterwards', () => {
  assert.equal(getShiftPhase(205).id, 'afternoon-commute');
  assert.equal(getShiftPhase(319.999).id, 'afternoon-commute');
  assert.equal(getShiftPhase(320).id, 'afternoon-commute');
  assert.equal(getShiftPhase(900).id, 'afternoon-commute');
  assert.equal(getShiftPhaseIndex(900), 4);
});

test('negative and non-finite elapsed values safely resolve to the opening phase', () => {
  for (const elapsed of [-10, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    assert.equal(getShiftPhase(elapsed).id, 'morning-network');
    assert.equal(getShiftPhaseIndex(elapsed), 0);
  }
});
