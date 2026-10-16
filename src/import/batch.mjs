import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { decodeLegacyFile, importFindItHtml, importJcloze } from './hotpot.mjs';

export async function previewHotPotBatch(inputDirectory) {
  const entries = (await readdir(inputDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));
  const supported = entries.filter((name) => /\.(?:jcl|html?)$/i.test(name));
  supported.sort((left, right) => {
    const leftJcl = /\.jcl$/i.test(left) ? 0 : 1;
    const rightJcl = /\.jcl$/i.test(right) ? 0 : 1;
    return leftJcl - rightJcl || left.localeCompare(right);
  });
  const byStem = new Map();
  for (const name of supported) {
    const stem = basename(name, extname(name)).toLocaleLowerCase();
    const group = byStem.get(stem) || [];
    group.push(name);
    byStem.set(stem, group);
  }
  const results = [];
  const consumed = new Set();
  for (const name of supported) {
    if (consumed.has(name)) continue;
    const extension = extname(name).toLocaleLowerCase();
    const stem = basename(name, extension).toLocaleLowerCase();
    const sameStem = byStem.get(stem) || [];
    const jclFiles = sameStem.filter((candidate) => /\.jcl$/i.test(candidate));
    const htmlFiles = sameStem.filter((candidate) => /\.html?$/i.test(candidate));
    if (jclFiles.length > 1 || htmlFiles.length > 1) {
      sameStem.forEach((candidate) => consumed.add(candidate));
      results.push({
        status: 'error',
        inputs: sameStem,
        error: `Ambiguous duplicate input stem "${stem}": expected at most one .jcl and one .htm/.html file.`
      });
      continue;
    }
    try {
      let model;
      let inputs;
      if (extension === '.jcl') {
        const pair = htmlFiles[0];
        const jcl = decodeLegacyFile(await readFile(join(inputDirectory, name)));
        const html = pair ? decodeLegacyFile(await readFile(join(inputDirectory, pair)), 'windows-1252') : undefined;
        model = importJcloze(jcl, html);
        inputs = pair ? [name, pair] : [name];
        if (pair) consumed.add(pair);
      }
      else {
        const html = decodeLegacyFile(await readFile(join(inputDirectory, name)), 'windows-1252');
        model = importFindItHtml(html);
        inputs = [name];
      }
      consumed.add(name);
      results.push({ status: 'ready', inputs, output: `${basename(name, extension)}.content.json`, title: model.title, targets: model.errors.length, warnings: model.warnings || [], model });
    }
    catch (error) {
      consumed.add(name);
      results.push({ status: 'error', inputs: [name], error: error.message });
    }
  }
  return {
    generatedAt: new Date().toISOString(),
    inputDirectory,
    summary: {
      ready: results.filter((item) => item.status === 'ready').length,
      errors: results.filter((item) => item.status === 'error').length
    },
    results
  };
}

export async function writeHotPotBatch(preview, outputDirectory) {
  await mkdir(outputDirectory, { recursive: true });
  for (const item of preview.results) {
    if (item.status !== 'ready') continue;
    await writeFile(join(outputDirectory, item.output), `${JSON.stringify(item.model, null, 2)}\n`, 'utf8');
  }
  const report = { ...preview, results: preview.results.map(({ model, ...item }) => item) };
  await writeFile(join(outputDirectory, 'import-report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return report;
}
