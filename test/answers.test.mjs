import test from 'node:test';
import assert from 'node:assert/strict';
import { isAcceptedAnswer, normalizeAnswer } from '../src/core/answers.mjs';

test('answers normalize Unicode and whitespace but preserve accents by default', () => {
  assert.equal(normalizeAnswer('  QUITTE\u0301E  '), 'quittée');
  assert.equal(isAcceptedAnswer('quittee', ['quittée']), false);
  assert.equal(isAcceptedAnswer(' QUITTÉE ', ['quittée']), true);
});

test('case-sensitive and terminal-punctuation policies are explicit', () => {
  assert.equal(isAcceptedAnswer('Réponse.', ['réponse'], { punctuation: 'ignore-terminal' }), true);
  assert.equal(isAcceptedAnswer('Réponse', ['réponse'], { caseSensitive: true }), false);
});

test('French typography policies handle NBSP, composed accents, hyphens and optional apostrophe folding', () => {
  assert.equal(isAcceptedAnswer('s\u2019est', ["s'est"]), false);
  assert.equal(isAcceptedAnswer('s\u2019est', ["s'est"], { normalizeApostrophes: true }), true);
  assert.equal(isAcceptedAnswer('porte-monnaie\u00a0', ['porte-monnaie']), true);
  assert.equal(isAcceptedAnswer('ENVOYE\u0301', ['envoyé']), true);
  assert.equal(isAcceptedAnswer('réponse\u202f;', ['réponse'], { punctuation: 'ignore-terminal' }), true);
});

