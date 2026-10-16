import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';

const required = [
  'H5P.FindAndCorrectErrors/library.json',
  'H5P.FindAndCorrectErrors/semantics.json',
  'H5P.FindAndCorrectErrors/scripts/find-and-correct-errors.js',
  'H5P.FindAndCorrectErrors/styles/find-and-correct-errors.css',
  'H5P.FindAndCorrectErrors/language/en.json',
  'H5P.FindAndCorrectErrors/language/fr.json',
  'H5PEditor.FindAndCorrectErrors/library.json',
  'H5PEditor.FindAndCorrectErrors/scripts/find-and-correct-errors-editor.js',
  'H5PEditor.FindAndCorrectErrors/styles/find-and-correct-errors-editor.css',
  'H5PEditor.FindAndCorrectErrors/language/en.json',
  'H5PEditor.FindAndCorrectErrors/language/fr.json',
  'MILESTONE5_ACCESSIBILITY_REPORT.md',
  'COMPATIBILITY_MATRIX.md',
  'SECURITY_AND_LICENSE_AUDIT.md',
  'SECURITY.md',
  'RELEASE_NOTES.md',
  'LICENSE',
  'tools/install-h5p-package.php'
];

for (const file of required) {
  await access(file);
}

const library = JSON.parse(await readFile('H5P.FindAndCorrectErrors/library.json', 'utf8'));
const semantics = JSON.parse(await readFile('H5P.FindAndCorrectErrors/semantics.json', 'utf8'));
const editorLibrary = JSON.parse(await readFile('H5PEditor.FindAndCorrectErrors/library.json', 'utf8'));
for (const language of ['en', 'fr']) {
  JSON.parse(await readFile(`H5P.FindAndCorrectErrors/language/${language}.json`, 'utf8'));
}

assert.equal(library.machineName, 'H5P.FindAndCorrectErrors');
assert.equal(library.patchVersion, 5);
assert.equal(library.runnable, 1);
assert.ok(library.preloadedDependencies.some((dependency) => dependency.machineName === 'H5P.Question'));
assert.ok(library.editorDependencies.some((dependency) => dependency.machineName === 'H5PEditor.FindAndCorrectErrors'));
assert.equal(editorLibrary.runnable, 0);
assert.equal(editorLibrary.machineName, 'H5PEditor.FindAndCorrectErrors');
assert.equal(editorLibrary.patchVersion, 3);
assert.equal(semantics.find((field) => field.name === 'markup').widget, 'findAndCorrectErrors');
assert.ok(semantics.some((field) => field.name === 'behaviour'));

const behaviour = semantics.find((field) => field.name === 'behaviour');
const pointFields = behaviour.fields.filter((field) => [
  'identificationPoints',
  'correctionPoints',
  'wrongTokenPenalty',
  'incorrectCorrectionPenalty',
  'hintPenalty'
].includes(field.name));
assert.equal(pointFields.length, 5);
for (const field of pointFields) {
  assert.equal(field.decimals, 1, `${field.name} must preserve half-point values`);
  assert.equal(field.step, undefined, `${field.name} must not use fractional step; H5P PHP uses integer modulo`);
}
console.log(`Validated ${required.length} required files and H5P JSON metadata.`);

