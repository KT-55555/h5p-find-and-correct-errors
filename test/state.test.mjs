import test from 'node:test';
import assert from 'node:assert/strict';
import { createRuntimeState, isErrorTerminal, isTaskTerminal } from '../src/core/state.mjs';

const errors = [
  { id: 'e1', maxAttempts: 2 },
  { id: 'e2', maxAttempts: 0 }
];

test('missing, malformed and version-mismatched state restores safely', () => {
  assert.deepEqual(createRuntimeState(errors, { version: 99 }), createRuntimeState(errors));
  const state = createRuntimeState(errors, {
    version: 2,
    errors: { e1: { found: 1, value: 4, attempts: -2 } },
    ledger: { 'identify:e1': 1, 'identify:unknown': 99, evil: 99 }
  });
  assert.equal(state.errors.e1.found, true);
  assert.equal(state.errors.e1.value, '');
  assert.equal(state.errors.e1.attempts, 0);
  assert.deepEqual(state.ledger, { 'identify:e1': 1 });
});

test('v1 state migrates without replaying credit or leaking answers', () => {
  const state = createRuntimeState(errors, {
    version: 1,
    errors: { e1: { found: true, corrected: false, value: 'essai', attempts: 1, hintUsed: true } },
    ledger: { 'identify:e1': 1 },
    answered: false,
    solutionsVisible: false
  });
  assert.equal(state.version, 3);
  assert.equal(state.errors.e1.hintsUsed, 1);
  assert.equal(state.ledger['identify:e1'], 1);
  assert.equal(state.solutionsVisible, false);
});

test('v2 state migrates retry state safely to v3', () => {
  const state = createRuntimeState(errors, { version: 2, errors: {}, ledger: {}, retries: 99 });
  assert.equal(state.version, 3);
  assert.equal(state.retries, 0);
});

test('attempt exhaustion creates a terminal path without requiring a correct answer', () => {
  const state = createRuntimeState(errors);
  state.errors.e1.found = true;
  state.errors.e1.attempts = 2;
  state.errors.e2.corrected = true;
  assert.equal(isErrorTerminal(errors[0], state.errors.e1), true);
  assert.equal(isTaskTerminal(errors, state), true);
});
