import { resolve } from 'node:path';
import { previewHotPotBatch, writeHotPotBatch } from '../src/import/batch.mjs';

const args = process.argv.slice(2);
const write = args.includes('--write');
const flagValue = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const positional = args.filter((arg, index) => !['--write', '--preview'].includes(arg) &&
  !['--input', '--output'].includes(args[index - 1]) && !['--input', '--output'].includes(arg));
const requestedInput = flagValue('--input') || positional[0];
const requestedOutput = flagValue('--output') || positional[1];
if (!requestedInput || (write && !requestedOutput)) {
  console.error('Usage: node tools/import-hotpot-batch.mjs --input <directory> [--output <directory> --write] [--preview]');
  console.error('   or: node tools/import-hotpot-batch.mjs <input-directory> [output-directory] [--write]');
  process.exitCode = 2;
}
else {
  const inputDirectory = resolve(requestedInput);
  const preview = await previewHotPotBatch(inputDirectory);
  if (write) {
    const outputDirectory = resolve(requestedOutput);
    const report = await writeHotPotBatch(preview, outputDirectory);
    console.log(JSON.stringify(report, null, 2));
  }
  else {
    console.log(JSON.stringify(preview, null, 2));
  }
  if (preview.summary.errors) process.exitCode = 1;
}
