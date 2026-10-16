import { readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { decodeLegacyFile, importJcloze } from '../src/import/hotpot.mjs';

const [jclArgument, htmlArgument, outputArgument] = process.argv.slice(2);
if (!jclArgument) {
  console.error('Usage: node tools/import-hotpot.mjs source.jcl [paired.htm] [output.json]');
  process.exitCode = 2;
}
else {
  const jclPath = resolve(jclArgument);
  const htmlPath = htmlArgument ? resolve(htmlArgument) : undefined;
  const outputPath = resolve(outputArgument ?? `${basename(jclPath, '.jcl')}.content.json`);
  const jcl = decodeLegacyFile(await readFile(jclPath));
  const html = htmlPath ? decodeLegacyFile(await readFile(htmlPath), 'windows-1252') : undefined;
  const model = importJcloze(jcl, html);
  await writeFile(outputPath, `${JSON.stringify(model, null, 2)}\n`, 'utf8');
  console.log(`Imported ${model.errors.length} errors to ${outputPath}`);
  for (const warning of model.warnings) {
    console.warn(`Warning: ${warning}`);
  }
}

