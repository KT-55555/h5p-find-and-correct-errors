import test from 'node:test';
import assert from 'node:assert/strict';
import { ScoreEngine } from '../src/core/score-engine.mjs';

const errors = [
  { id: 'e1' },
  { id: 'e2', points: { identification: 2, correction: 3 } }
];

test('default score awards are idempotent and wrong clicks deduplicate by token', () => {
  const score = new ScoreEngine(errors);
  assert.equal(score.getMaxScore(), 7);
  assert.equal(score.identify('e1'), true);
  assert.equal(score.identify('e1'), false);
  assert.equal(score.correct('e1'), true);
  assert.equal(score.correct('e1'), false);
  assert.equal(score.attempts.get('e1'), 1);
  assert.equal(score.wrongToken('token-9'), true);
  assert.equal(score.wrongToken('token-9'), false);
  assert.deepEqual(score.getXapiScore(), { min: 0, max: 7, raw: 1.5, scaled: 1.5 / 7 });
});

test('penalties never reduce max and final raw clamps to zero', () => {
  const score = new ScoreEngine([{ id: 'e1' }], { wrongTokenPenalty: 0.5 });
  for (let index = 0; index < 10; index += 1) {
    score.wrongToken(`token-${index}`);
  }
  assert.deepEqual(score.getXapiScore(), { min: 0, max: 2, raw: 0, scaled: 0 });
});

test('restored ledgers cannot replay awards', () => {
  const first = new ScoreEngine([{ id: 'e1' }]);
  first.identify('e1');
  first.incorrectCorrection('e1');
  const restored = new ScoreEngine([{ id: 'e1' }], {}, first.getState());
  assert.equal(restored.identify('e1'), false);
  assert.equal(restored.attempts.get('e1'), 1);
});

test('zero maximum and invalid negative policies are rejected', () => {
  assert.throws(() => new ScoreEngine([{ id: 'e1' }], {
    identificationPoints: 0,
    correctionPoints: 0
  }), /greater than zero/);
  assert.throws(() => new ScoreEngine([{ id: 'e1' }], { wrongTokenPenalty: -1 }), /non-negative/);
});

