import test from 'node:test';
import assert from 'node:assert/strict';
import { errorForToken, tokenize, validateAnnotations } from '../src/core/tokenizer.mjs';

test('French apostrophes, accents and hyphenated forms remain stable word tokens', () => {
  const words = tokenize("Où l’on voit porte-monnaie, aujourd'hui.")
    .filter((token) => token.type === 'word')
    .map((token) => token.text);
  assert.deepEqual(words, ['Où', 'l’on', 'voit', 'porte-monnaie', "aujourd'hui"]);
});

test('punctuation and whitespace are inert and phrase constituents map to one error', () => {
  const source = 'Il a prendre soin de cela.';
  const start = source.indexOf('prendre soin');
  const error = { id: 'e1', start, end: start + 12, source: 'prendre soin', accepted: ['pris soin'] };
  validateAnnotations(source, [error]);
  const tokens = tokenize(source);
  assert.equal(errorForToken(tokens.find((token) => token.text === 'prendre'), [error]).id, 'e1');
  assert.equal(errorForToken(tokens.find((token) => token.text === 'soin'), [error]).id, 'e1');
  assert.equal(errorForToken(tokens.find((token) => token.text === ' '), [error]), null);
  assert.equal(errorForToken(tokens.find((token) => token.text === '.'), [error]), null);
});

test('overlapping annotations are rejected', () => {
  const source = 'alpha beta';
  assert.throws(() => validateAnnotations(source, [
    { id: 'a', start: 0, end: 5, source: 'alpha', accepted: ['x'] },
    { id: 'b', start: 4, end: 10, source: 'a beta', accepted: ['y'] }
  ]), /overlap/);
});

