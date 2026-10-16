import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const dependencyRequire = process.env.FCE_TEST_DEPS_ROOT
  ? createRequire(join(process.env.FCE_TEST_DEPS_ROOT, 'package.json'))
  : createRequire(import.meta.url);
const { JSDOM } = dependencyRequire('jsdom');
const axe = dependencyRequire('axe-core');

const runtimeSource = await readFile(new URL('../H5P.FindAndCorrectErrors/scripts/find-and-correct-errors.js', import.meta.url), 'utf8');
const editorSource = await readFile(new URL('../H5PEditor.FindAndCorrectErrors/scripts/find-and-correct-errors-editor.js', import.meta.url), 'utf8');

test('learner DOM flow deduplicates wrong clicks, checks phrases, scores, emits xAPI and restores state', () => {
  const { window, events } = runtimeWindow();
  const params = {
    taskDescription: '<p>Correct the text.</p>',
    markup: 'Un mot neutre. Elles [se sont envoyées|se sont envoyé||se sont transmis] hier.',
    errorSettings: [{ setting: { errorNumber: 1, hint: 'No agreement', maxAttempts: 2 } }],
    behaviour: {
      validationTiming: 'live', caseSensitive: false, collapseWhitespace: true, punctuation: 'preserve',
      identificationPoints: 1, correctionPoints: 1, wrongTokenPenalty: 0.5,
      incorrectCorrectionPenalty: 0.5, hintPenalty: 0.5, showRemaining: true,
      autoComplete: false, enableRetry: true, enableSolutionsButton: true, revealOnExhaustion: true,
      displayMode: 'correct'
    }
  };
  const instance = new window.H5P.FindAndCorrectErrors(params, 1, {});
  const buttons = [...instance.text.querySelectorAll('.fce-token')];
  const neutral = buttons.find((button) => button.textContent === 'neutre');
  neutral.click(); neutral.click();
  assert.equal(instance.getScore(), 0);
  assert.equal(Object.keys(instance.state.ledger).filter((key) => key.startsWith('wrong:')).length, 1);

  buttons.find((button) => button.textContent === 'sont').click();
  const input = instance.text.querySelector('.fce-correction');
  assert.equal(input.value, 'se sont envoyées');
  input.value = 'incorrect'; input.dispatchEvent(new window.Event('input', { bubbles: true }));
  input.dispatchEvent(new window.Event('change', { bubbles: true }));
  instance.text.querySelector('.fce-hint').click();
  const retryInput = instance.text.querySelector('.fce-correction');
  retryInput.value = 'SE SONT ENVOYE\u0301'; retryInput.dispatchEvent(new window.Event('input', { bubbles: true }));
  retryInput.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal(instance.state.errors['error-1'].corrected, true);
  assert.equal(instance.getMaxScore(), 2);
  assert.equal(instance.getScore(), 0.5);

  instance.finish();
  assert.equal(instance.getAnswerGiven(), true);
  assert.equal(instance.getCurrentState().version, 3);
  assert.deepEqual(events.filter((event) => event && event.data).map((event) => event.data.statement.verb), ['answered', 'completed']);
  const xapi = instance.getXAPIData().statement;
  assert.equal(xapi.object.definition.interactionType, 'fill-in');
  assert.equal(xapi.result.score.raw, 0.5);
  assert.equal(xapi.result.score.max, 2);
  assert.equal(xapi.result.score.scaled, 0.25);
  assert.equal(xapi.result.completion, true);

  const restored = new window.H5P.FindAndCorrectErrors(params, 1, { previousState: instance.getCurrentState() });
  assert.equal(restored.getScore(), 0.5);
  assert.equal(restored.state.errors['error-1'].attempts, 2);
  assert.equal(restored.state.errors['error-1'].corrected, true);

  const tampered = structuredClone(instance.getCurrentState());
  tampered.ledger['correct:error-1'] = 999;
  tampered.ledger['identify:unknown'] = 999;
  const sanitized = new window.H5P.FindAndCorrectErrors(params, 1, { previousState: tampered });
  assert.equal(sanitized.state.ledger['correct:error-1'], undefined);
  assert.equal(sanitized.state.ledger['identify:unknown'], undefined);
});

test('attempt exhaustion is terminal without falsely auto-completing and a multiword target opens one field from either word', () => {
  const { window } = runtimeWindow();
  const params = {
    markup: 'Ils [se sont envoyées|se sont envoyé] une lettre.',
    errorSettings: [{ setting: { errorNumber: 1, maxAttempts: 1 } }],
    behaviour: { validationTiming: 'live', identificationPoints: 1, correctionPoints: 1, wrongTokenPenalty: 0, incorrectCorrectionPenalty: 0, hintPenalty: 0, autoComplete: true, enableRetry: true, enableSolutionsButton: true, revealOnExhaustion: true }
  };
  const first = new window.H5P.FindAndCorrectErrors(params, 2, {});
  [...first.text.querySelectorAll('.fce-token')].find((button) => button.textContent === 'sont').click();
  assert.equal(first.text.querySelectorAll('.fce-correction').length, 1);
  const input = first.text.querySelector('.fce-correction');
  input.value = 'no'; input.dispatchEvent(new window.Event('input', { bubbles: true })); input.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal(first.state.errors['error-1'].exhausted, true);
  assert.equal(first.answered, false);
  first.finish();
  assert.equal(first.answered, true);
});

test('learner accepts the entity-encoded FCE2 payload produced by WordPress H5P filtering', () => {
  const { window } = runtimeWindow();
  const payload = {
    schemaVersion: 2,
    source: "The students was ready, but they didn't finished.",
    html: '<p>The students <span data-fce-id="error-1">was</span> ready, but they <span data-fce-id="error-2">didn\'t finished</span>.</p>',
    errors: [
      { id: 'error-1', start: 13, end: 16, source: 'was', accepted: ['were'] },
      { id: 'error-2', start: 33, end: 48, source: "didn't finished", accepted: ["didn't finish"] }
    ]
  };
  const filtered = ('FCE2\n' + JSON.stringify(payload))
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
  const instance = new window.H5P.FindAndCorrectErrors({ markup: filtered }, 4, {});
  assert.equal(instance.model.errors.length, 2);
  assert.equal(instance.model.errors[1].accepted[0], "didn't finish");
  assert.match(instance.text.textContent, /students/);
});

test('exhaustion does not auto-complete, count modes and retry limits are enforced, and hidden disclosure stays hidden', () => {
  const { window } = runtimeWindow();
  const instance = new window.H5P.FindAndCorrectErrors({
    markup: '[bad|good]',
    errorSettings: [{ setting: { errorNumber: 1, hint: 'A hint', explanation: '<p>Why.</p>', maxAttempts: 1 } }],
    behaviour: {
      validationTiming: 'live', autoComplete: true, countDisplay: 'total', enableHints: false,
      identificationPoints: 1, correctionPoints: 1, wrongTokenPenalty: 0,
      incorrectCorrectionPenalty: 0, hintPenalty: 0, enableRetry: true, maxRetries: 1,
      enableSolutionsButton: true, solutionDisclosure: 'never', feedbackTiming: 'never', displayMode: 'original'
    }
  }, 5, {});
  assert.equal(instance.remaining.textContent, 'Errors to find: 1');
  instance.text.querySelector('.fce-token').click();
  assert.equal(instance.text.querySelector('.fce-hint'), null);
  const wrong = instance.text.querySelector('.fce-correction');
  wrong.value = 'no'; wrong.dispatchEvent(new window.Event('input', { bubbles: true })); wrong.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal(instance.state.errors['error-1'].exhausted, true);
  assert.equal(instance.answered, false, 'exhaustion is terminal but not successful auto-completion');
  instance.finish();
  assert.equal(instance.buttons['fce-solution'].hidden, true);
  assert.match(instance.text.textContent, /bad/);
  assert.doesNotMatch(instance.text.textContent, /good|Why/);
  assert.equal(instance.buttons['fce-retry'].hidden, false);
  instance.buttons['fce-retry'].click();
  assert.equal(instance.state.retries, 1);
  instance.text.querySelector('.fce-token').click();
  const correct = instance.text.querySelector('.fce-correction');
  correct.value = 'GOOD'; correct.dispatchEvent(new window.Event('input', { bubbles: true })); correct.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal(instance.answered, true);
  assert.equal(instance.text.textContent, 'bad');
  assert.equal(instance.buttons['fce-retry'].hidden, true);
});

test('deferred validation, completion disclosure, final feedback and all corrected-text display modes are consistent', () => {
  const { window } = runtimeWindow();
  const payload = 'FCE2\n' + JSON.stringify({
    schemaVersion: 2, source: 'bad', html: '<p><span data-fce-id="e1">bad</span></p>',
    errors: [{ id: 'e1', start: 0, end: 3, source: 'bad', accepted: ['good'], explanation: '<p>Explanation.</p>', maxAttempts: 1 }]
  });
  const deferred = new window.H5P.FindAndCorrectErrors({ markup: payload, behaviour: {
    validationTiming: 'deferred', autoComplete: false, countDisplay: 'hidden', solutionDisclosure: 'completion',
    feedbackTiming: 'final', identificationPoints: 1, correctionPoints: 1, wrongTokenPenalty: 0,
    incorrectCorrectionPenalty: 0, hintPenalty: 0
  } }, 6, {});
  assert.equal(deferred.remaining.textContent, '');
  deferred.text.querySelector('.fce-token').click();
  const input = deferred.text.querySelector('.fce-correction');
  input.value = 'wrong'; input.dispatchEvent(new window.Event('input', { bubbles: true })); input.dispatchEvent(new window.Event('change', { bubbles: true }));
  assert.equal(deferred.state.errors.e1.attempts, 0);
  deferred.finish();
  assert.equal(deferred.state.errors.e1.exhausted, true);
  assert.match(deferred.text.textContent, /good/);
  assert.match(deferred.text.textContent, /Explanation/);

  for (const [mode, answer, expected] of [['correct', 'GOOD', 'good'], ['learner', 'GOOD', 'GOOD'], ['original', 'GOOD', 'bad']]) {
    const item = new window.H5P.FindAndCorrectErrors({ markup: '[bad|good]', behaviour: {
      validationTiming: 'live', autoComplete: true, displayMode: mode, identificationPoints: 1,
      correctionPoints: 1, wrongTokenPenalty: 0, incorrectCorrectionPenalty: 0, hintPenalty: 0
    } }, `mode-${mode}`, {});
    item.text.querySelector('.fce-token').click();
    const field = item.text.querySelector('.fce-correction');
    field.value = answer; field.dispatchEvent(new window.Event('input', { bubbles: true })); field.dispatchEvent(new window.Event('change', { bubbles: true }));
    assert.equal(item.text.textContent, expected);
  }
});

test('multiple runtime instances keep state and scoring isolated', () => {
  const { window } = runtimeWindow();
  const params = { markup: 'A [bad|good] example.', behaviour: { identificationPoints: 1, correctionPoints: 1, wrongTokenPenalty: 0.5 } };
  const first = new window.H5P.FindAndCorrectErrors(params, 11, {});
  const second = new window.H5P.FindAndCorrectErrors(params, 12, {});
  first.text.querySelectorAll('.fce-token')[1].click();
  assert.equal(first.state.errors['error-1'].found, true);
  assert.equal(first.getScore(), 1);
  assert.equal(second.state.errors['error-1'].found, false);
  assert.equal(second.getScore(), 0);
  assert.equal(second.text.querySelectorAll('.fce-correction').length, 0);
});

test('learner surface has no serious or critical automated axe violations', async () => {
  const { window } = runtimeWindow();
  const instance = new window.H5P.FindAndCorrectErrors({ markup: 'The [students was|student was] ready.' }, 3, {});
  window.document.body.appendChild(instance.wrapper);
  window.HTMLCanvasElement.prototype.getContext = () => null;
  window.eval(axe.source);
  const result = await window.axe.run(window.document, { rules: { 'color-contrast': { enabled: false } } });
  assert.equal(result.violations.filter((item) => ['serious', 'critical'].includes(item.impact)).length, 0);
});

test('editor widget migrates compact markup, saves FCE2, reopens, toggles modes and rejects malformed markup', () => {
  const dom = new JSDOM('<!doctype html><html lang="en"><body><div id="editor"></div></body></html>', { runScripts: 'outside-only', url: 'https://local.test/' });
  const { window } = dom;
  window.H5P = { jQuery: jqueryStub(window) };
  window.H5PEditor = { widgets: {}, t: () => null };
  window.eval(editorSource);
  let saved = '';
  const wrapper = { get: () => window.document.getElementById('editor') };
  const Widget = window.H5PEditor.FindAndCorrectErrors;
  const widget = new Widget({}, { label: 'Exercise', default: '[wrong|right]' }, 'A [wrong|right] answer.', (_field, value) => { saved = value; });
  widget.appendTo(wrapper);
  assert.match(saved, /^FCE2\n/);
  assert.equal(widget.container.querySelectorAll('[role="tab"]').length, 2);
  assert.equal(widget.visual.getAttribute('aria-label'), 'Exercise visual editor');
  assert.equal(widget.markup.getAttribute('aria-label'), 'Exercise markup editor');
  widget.selectTarget(widget.model.errors[0].id);
  const targetNumbers = [...widget.detailsBody.querySelectorAll('input[type="number"]')];
  assert.equal(targetNumbers.length, 5);
  for (const [input, value] of targetNumbers.slice(1).map((input, index) => [input, ['1.5', '2.5', '0.5', '0.25'][index]])) {
    input.value = value;
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
  }
  assert.equal(JSON.stringify(widget.model.errors[0].points), JSON.stringify({ identification: 1.5, correction: 2.5 }));
  assert.equal(JSON.stringify(widget.model.errors[0].penalties), JSON.stringify({ incorrectCorrection: 0.5, hint: 0.25 }));
  widget.showMarkup();
  assert.equal(widget.markup.value, 'A [wrong|right] answer.');
  assert.equal(widget.showVisual(), undefined);
  assert.equal(widget.validate(), true);
  const reopened = new Widget({}, { label: 'Exercise' }, saved, () => {});
  reopened.appendTo({ get: () => window.document.body.appendChild(window.document.createElement('div')) });
  assert.equal(reopened.model.errors[0].id, widget.model.errors[0].id);
  assert.equal(reopened.model.errors[0].points.correction, 2.5);
  const filteredSaved = saved.slice(0, 5) + saved.slice(5)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
  const filteredReopen = new Widget({}, { label: 'Exercise' }, filteredSaved, () => {});
  filteredReopen.appendTo({ get: () => window.document.body.appendChild(window.document.createElement('div')) });
  assert.equal(filteredReopen.model.errors[0].id, widget.model.errors[0].id);
  reopened.showMarkup(); reopened.markup.value = 'bad [markup|]';
  assert.equal(reopened.validate(), false);
  assert.match(reopened.warning.textContent, /Fix the markup error/);
});

function runtimeWindow() {
  const dom = new JSDOM('<!doctype html><html lang="en"><head><title>Runtime test</title></head><body></body></html>', { runScripts: 'outside-only', url: 'https://local.test/' });
  const { window } = dom;
  const events = [];
  function Question() { this.buttons = {}; this.wrapper = window.document.createElement('section'); this.actions = window.document.createElement('div'); this.wrapper.appendChild(this.actions); }
  Question.prototype.setContent = function ($content) { this.content = $content.get(0); this.wrapper.insertBefore(this.content, this.actions); };
  Question.prototype.addButton = function (id, label, handler, visible, attrs) { const node = window.document.createElement('button'); node.textContent = label; node.addEventListener('click', handler); Object.entries(attrs || {}).forEach(([key, value]) => node.setAttribute(key, value)); node.hidden = !visible; this.buttons[id] = node; this.actions.appendChild(node); };
  Question.prototype.showButton = function (id) { this.buttons[id].hidden = false; };
  Question.prototype.hideButton = function (id) { this.buttons[id].hidden = true; };
  Question.prototype.setFeedback = function (text, score, max) { this.feedback = { text, score, max }; };
  Question.prototype.removeFeedback = function () { delete this.feedback; };
  Question.prototype.trigger = function (event) { events.push(event); };
  Question.prototype.trigger.bind = Function.prototype.bind;
  Question.prototype.createXAPIEventTemplate = function (verb) {
    const statement = { verb, object: { definition: {} }, result: {} };
    return { data: { statement }, setScoredResult(raw, max, _instance, completion, success) { statement.result.score = { min: 0, raw, max, scaled: raw / max }; statement.result.completion = completion; statement.result.success = success; } };
  };
  window.H5P = { jQuery: jqueryStub(window), Question };
  window.eval(runtimeSource);
  return { window, events };
}

function jqueryStub(window) {
  function jquery(value) { return { 0: value, length: 1, get: (index) => index === 0 ? value : undefined }; }
  jquery.extend = function (_deep, target, ...sources) { for (const source of sources) merge(target, source); return target; };
  return jquery;
}

function merge(target, source) {
  for (const [key, value] of Object.entries(source || {})) {
    if (value && typeof value === 'object' && !Array.isArray(value)) { target[key] = target[key] || {}; merge(target[key], value); }
    else target[key] = Array.isArray(value) ? value.map((item) => typeof item === 'object' ? structuredClone(item) : item) : value;
  }
}
