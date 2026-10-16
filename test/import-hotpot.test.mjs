import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decodeLegacyFile, importFindItHtml, importJcloze, inspectFindItHtml } from '../src/import/hotpot.mjs';
import { previewHotPotBatch, writeHotPotBatch } from '../src/import/batch.mjs';

const syntheticJcl = `<?xml version="1.0" encoding="UTF-8"?>
<hotpot-jcloze-file><version>6</version><data><title>Synthetic agreement check</title>
<gap-fill>The team <question-record><answer><text>is</text><correct>1</correct></answer><answer><text>are</text><correct>1</correct></answer><clue>Use a singular verb.</clue></question-record> ready.
They <question-record><answer><text>have finished</text><correct>1</correct></answer><answer><text>has finish</text><correct>1</correct></answer><clue>Check the subject and participle.</clue></question-record> the review.</gap-fill>
</data></hotpot-jcloze-file>`;

const syntheticHtml = `<!doctype html><html><head><title>Synthetic agreement check</title></head><body>
<!-- Find-it - Version 3.2b for Hot Potatoes v6 -->
<script>
function Get_WrongGapContent(GapId){return I[GapId][1][1][0];}
var I=[];
I[0]=[]; I[0][1]=[]; I[0][1][0]=[]; I[0][1][0][0]='is'; I[0][1][1]=[]; I[0][1][1][0]='are'; I[0][2]='Use a singular verb.';
I[1]=[]; I[1][1]=[]; I[1][1][0]=[]; I[1][1][0][0]='have finished'; I[1][1][1]=[]; I[1][1][1][0]='has finish'; I[1][2]='Check the subject and participle.';
</script>
<h2 class="ExerciseTitle">Synthetic agreement check</h2>
<div id="ClozeBody">The team <span id="GapSpan0"><img src=x onerror="globalThis.importExecuted=true"></span> ready.<br>
They <span id="GapSpan1"><script>globalThis.importExecuted=true</script></span> the review.</div>
</body></html>`;

test('synthetic paired source imports corrections, displayed errors and hints in order', () => {
  const model = importJcloze(syntheticJcl, syntheticHtml);
  assert.equal(model.errors.length, 2);
  assert.deepEqual(model.errors.map((error) => error.source), ['are', 'has finish']);
  assert.deepEqual(model.errors.map((error) => error.accepted[0]), ['is', 'have finished']);
  assert.deepEqual(model.errors.map((error) => error.hints[0]), [
    'Use a singular verb.', 'Check the subject and participle.'
  ]);
  assert.equal(model.source, 'The team are ready.\nThey has finish the review.');
});

test('synthetic generated HTML confirms the second answer is displayed as wrong', () => {
  const evidence = inspectFindItHtml(syntheticHtml);
  assert.equal(evidence.version, '3.2b');
  assert.equal(evidence.usesSecondAnswerAsWrong, true);
  assert.equal(evidence.records[0].correction, 'is');
  assert.equal(evidence.records[0].displayedWrong, 'are');
  assert.equal(evidence.records[0].clue, 'Use a singular verb.');
});

test('standalone Find-it HTML is parsed as inert data and strips executable markup', () => {
  globalThis.importExecuted = false;
  const model = importFindItHtml(syntheticHtml);
  assert.equal(model.errors.length, 2);
  assert.equal(model.errors[0].source, 'are');
  assert.equal(model.errors[0].accepted[0], 'is');
  assert.equal(model.errors[0].hints[0], 'Use a singular verb.');
  assert.match(model.source, /^The team are ready\./);
  assert.doesNotMatch(model.source, /<script|onerror|<img/i);
  assert.equal(globalThis.importExecuted, false);
});

test('active XML declarations and mismatched pairs are rejected', () => {
  assert.throws(() => importJcloze('<?xml version="1.0"?><!DOCTYPE x><version>6</version>'), /not permitted/);
  assert.throws(() => inspectFindItHtml('<script>var I=[];</script>'), /signature/);
  assert.throws(() => importFindItHtml('Find-it - Version 3.2b<script>var I=[];</script>'), /second-answer|ClozeBody|answer records/);
});

test('batch preview pairs matching JCL/HTML, reports malformed files and writes only reviewed JSON outputs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fce-import-test-'));
  const input = join(root, 'input');
  const output = join(root, 'output');
  try {
    await mkdir(input);
    await writeFile(join(input, 'lesson.jcl'), syntheticJcl);
    await writeFile(join(input, 'lesson.htm'), syntheticHtml);
    await writeFile(join(input, 'broken.html'), '<html>unknown</html>');
    const preview = await previewHotPotBatch(input);
    assert.deepEqual(preview.summary, { ready: 1, errors: 1 });
    assert.equal(preview.results.find((item) => item.status === 'ready').targets, 2);
    assert.match(preview.results.find((item) => item.status === 'error').error, /Unsupported HTML/);
    const report = await writeHotPotBatch(preview, output);
    assert.equal(report.summary.ready, 1);
    assert.equal(JSON.parse(await readFile(join(output, 'lesson.content.json'), 'utf8')).errors.length, 2);
    assert.equal(JSON.parse(await readFile(join(output, 'import-report.json'), 'utf8')).results.some((item) => 'model' in item), false);
  }
  finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('batch preview rejects ambiguous duplicate stems instead of overwriting output', async () => {
  const root = await mkdtemp(join(tmpdir(), 'fce-import-duplicate-'));
  try {
    await writeFile(join(root, 'lesson.htm'), syntheticHtml);
    await writeFile(join(root, 'lesson.html'), syntheticHtml);
    const preview = await previewHotPotBatch(root);
    assert.deepEqual(preview.summary, { ready: 0, errors: 1 });
    assert.deepEqual(preview.results[0].inputs, ['lesson.htm', 'lesson.html']);
    assert.match(preview.results[0].error, /Ambiguous duplicate input stem/);
  }
  finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('legacy byte decoder rejects oversized and invalid UTF-8 input deterministically', () => {
  assert.throws(() => decodeLegacyFile(new Uint8Array((2 * 1024 * 1024) + 1)), /byte limit/);
  assert.throws(() => decodeLegacyFile(Uint8Array.from([0xc3, 0x28]), 'utf-8'), /Unable to decode/);
});

