import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MODEL_PREFIX,
  applyCompactMarkup,
  htmlToPlainText,
  parseAuthoringValue,
  sanitizeRichHtml,
  serializeAuthoringValue,
  toCompactMarkup
} from '../src/core/model.mjs';

test('legacy markup migrates to a stable FCE2 model and round-trips deterministically', () => {
  const model = parseAuthoringValue(String.raw`Un [mot|terme||vocable] et \[note\].`);
  model.errors[0].hints = ['Indice'];
  model.errors[0].explanation = '<strong>Explication</strong>';
  const serialized = serializeAuthoringValue(model);
  assert.ok(serialized.startsWith(MODEL_PREFIX));
  assert.equal(serializeAuthoringValue(parseAuthoringValue(serialized)), serialized);
  assert.equal(toCompactMarkup(parseAuthoringValue(serialized)), String.raw`Un [mot|terme||vocable] et \[note].`);
  assert.deepEqual(parseAuthoringValue(serialized).errors[0].hints, ['Indice']);
});

test('rich formatting and stable ids survive repeated visual-markup toggles without edits', () => {
  const model = parseAuthoringValue('[envoyées|envoyé]');
  model.html = '<p><strong><span data-fce-id="error-1">envoyées</span></strong></p>';
  const first = parseAuthoringValue(serializeAuthoringValue(model));
  const applied = applyCompactMarkup(toCompactMarkup(first), first);
  assert.equal(applied.formattingReset, false);
  assert.equal(applied.model.errors[0].id, 'error-1');
  assert.equal(applied.model.html, first.html);
});

test('markup text edits explicitly report formatting reset and preserve target metadata by order', () => {
  const model = parseAuthoringValue('[envoyées|envoyé]');
  model.html = '<p><em><span data-fce-id="error-1">envoyées</span></em></p>';
  model.errors[0].hints = ['Accord'];
  const result = applyCompactMarkup('[envoyéess|envoyé]', model);
  assert.equal(result.formattingReset, true);
  assert.equal(result.model.errors[0].id, 'error-1');
  assert.deepEqual(result.model.errors[0].hints, ['Accord']);
});

test('sanitizer removes executable markup and dangerous attributes', () => {
  const dirty = '<p onclick="alert(1)">Texte<script>alert(2)</script><a href="javascript:x">lien</a><span data-fce-id="safe">mot</span></p>';
  const clean = sanitizeRichHtml(dirty);
  assert.equal(clean, '<p>Textelien<span data-fce-id="safe">mot</span></p>');
  assert.equal(htmlToPlainText(clean), 'Textelienmot');
  assert.doesNotMatch(clean, /onclick|script|javascript|href/i);
});

test('malformed extended models and mismatched ranges are rejected safely', () => {
  assert.throws(() => parseAuthoringValue('FCE2\n{bad'), /not valid JSON/);
  assert.throws(() => parseAuthoringValue('FCE2\n' + JSON.stringify({
    source: 'abc',
    errors: [{ id: 'e', start: 0, end: 2, source: 'wrong', accepted: ['x'] }]
  })), /does not match/);
});

test('property-style compact and extended round-trips retain Unicode and delimiters', () => {
  const cases = [
    String.raw`[é|è]`,
    String.raw`Avant [é|é] après.`,
    String.raw`[cœur|choeur] et [porte-monnaie|portemonnaie]`,
    String.raw`L’[apostrophe|apostrophe droite||apostrophe courbe]`,
    String.raw`Paragraphe un.
Paragraphe [deux|2].`,
    String.raw`Littéraux \[crochets\] et [barre\|verticale|barre verticale].`
  ];
  for (const markup of cases) {
    let model = parseAuthoringValue(markup);
    const canonicalMarkup = toCompactMarkup(model);
    for (let iteration = 0; iteration < 5; iteration += 1) {
      model = parseAuthoringValue(serializeAuthoringValue(model));
      assert.equal(toCompactMarkup(model), canonicalMarkup);
    }
  }
});
