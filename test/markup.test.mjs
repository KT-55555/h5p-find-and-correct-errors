import test from 'node:test';
import assert from 'node:assert/strict';
import { MarkupSyntaxError, parseMarkup, serializeMarkup } from '../src/core/markup.mjs';

test('markup parses multiple answers and round-trips escaped separators', () => {
  const markup = String.raw`Avant [porte\|monnaie|porte-monnaie||portemonnaie] après \[note\].`;
  const model = parseMarkup(markup);
  assert.equal(model.source, 'Avant porte|monnaie après [note].');
  assert.deepEqual(model.errors[0].accepted, ['porte-monnaie', 'portemonnaie']);
  assert.deepEqual(parseMarkup(serializeMarkup(model)), model);
});

test('markup reports located syntax errors', () => {
  assert.throws(() => parseMarkup('Texte [faux|]'), (error) => {
    assert.ok(error instanceof MarkupSyntaxError);
    assert.equal(error.offset, 6);
    return true;
  });
});

