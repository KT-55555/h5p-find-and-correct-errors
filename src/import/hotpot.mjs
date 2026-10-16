import { decodeSafeEntities, stripXmlTags } from '../core/entities.mjs';
import { validateAnnotations } from '../core/tokenizer.mjs';

const MAX_FILE_BYTES = 2 * 1024 * 1024;

export function decodeLegacyFile(bytes, declaredEncoding = undefined) {
  if (!(bytes instanceof Uint8Array)) {
    throw new TypeError('Legacy input must be bytes.');
  }
  if (bytes.byteLength > MAX_FILE_BYTES) {
    throw new Error(`Legacy file exceeds the ${MAX_FILE_BYTES} byte limit.`);
  }
  const asciiHead = new TextDecoder('windows-1252').decode(bytes.slice(0, 256));
  const declared = declaredEncoding ?? asciiHead.match(/encoding=["']([^"']+)["']/i)?.[1] ?? 'windows-1252';
  const normalized = /^iso-8859-1$/i.test(declared) ? 'windows-1252' : declared;
  try {
    return new TextDecoder(normalized, { fatal: true }).decode(bytes);
  }
  catch (error) {
    throw new Error(`Unable to decode legacy file as ${declared}: ${error.message}`);
  }
}

export function importJcloze(jclText, htmlText = undefined) {
  rejectActiveXml(jclText);
  const version = textOf(jclText, 'version');
  if (version !== '6') {
    throw new Error(`Unsupported Hot Potatoes version: ${version || 'missing'}.`);
  }
  const gapFillMatch = String(jclText).match(/<gap-fill>([\s\S]*?)<\/gap-fill>/i);
  if (!gapFillMatch) {
    throw new Error('No JCloze gap-fill content was found.');
  }

  const records = [];
  const recordPattern = /<question-record>([\s\S]*?)<\/question-record>/gi;
  let match;
  while ((match = recordPattern.exec(gapFillMatch[1])) !== null) {
    const answerPattern = /<answer>([\s\S]*?)<\/answer>/gi;
    const answers = [];
    let answerMatch;
    while ((answerMatch = answerPattern.exec(match[1])) !== null) {
      const text = decodeText(textOf(answerMatch[1], 'text')).trimEnd();
      const correct = textOf(answerMatch[1], 'correct') === '1';
      if (correct) {
        answers.push(text);
      }
    }
    if (answers.length < 2) {
      throw new Error(`Question record ${records.length + 1} does not contain the paired Find-it answers.`);
    }
    const clue = decodeText(textOf(match[1], 'clue')).trim();
    records.push({ correction: answers[0], displayedWrong: answers[1], clue, answerCount: answers.length });
  }
  if (records.length === 0) {
    throw new Error('No Find-it question records were found.');
  }

  const warnings = [];
  let recordIndex = 0;
  const source = decodeText(gapFillMatch[1].replace(recordPattern, () => {
    const current = records[recordIndex++];
    return current.displayedWrong;
  })).replace(/\r\n?/g, '\n');

  const errors = [];
  let searchStart = 0;
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const start = source.indexOf(record.displayedWrong, searchStart);
    if (start < 0) {
      throw new Error(`Displayed wrong form for record ${index + 1} could not be placed in source order.`);
    }
    errors.push({
      id: `error-${index + 1}`,
      start,
      end: start + record.displayedWrong.length,
      source: record.displayedWrong,
      accepted: [record.correction],
      hints: record.clue ? [record.clue] : [],
      explanation: ''
    });
    searchStart = start + record.displayedWrong.length;
    if (record.answerCount > 2) {
      warnings.push(`Record ${index + 1} has more than two correct-marked answers; only paired Find-it positions were used.`);
    }
  }

  if (htmlText !== undefined) {
    const htmlEvidence = inspectFindItHtml(htmlText);
    if (!htmlEvidence.usesSecondAnswerAsWrong) {
      throw new Error('Paired HTML does not confirm the Find-it second-answer display convention.');
    }
    if (htmlEvidence.records.length !== records.length) {
      throw new Error('JCL and HTML contain different error counts.');
    }
    records.forEach((record, index) => {
      const evidence = htmlEvidence.records[index];
      if (record.correction !== evidence.correction || record.displayedWrong !== evidence.displayedWrong) {
        throw new Error(`JCL and HTML disagree at error ${index + 1}.`);
      }
    });
  }

  const title = decodeText(textOf(jclText, 'title')).trim();
  const model = { schemaVersion: 1, title, source, errors: validateAnnotations(source, errors), warnings };
  return model;
}

export function inspectFindItHtml(htmlText) {
  const source = String(htmlText);
  const header = /Find-it\s*-\s*Version\s+3\.2b/i.test(source);
  if (!header) {
    throw new Error('Unsupported HTML: Find-it 3.2b signature not found.');
  }
  const usesSecondAnswerAsWrong = /function\s+Get_WrongGapContent[\s\S]*?I\[GapId\]\[1\]\[1\]\[0\]/.test(source);
  const corrections = extractJsArrayValues(source, 0);
  const wrong = extractJsArrayValues(source, 1);
  const indexes = [...new Set([...corrections.keys(), ...wrong.keys()])].sort((a, b) => a - b);
  const clues = extractIndexedJsValues(source, 2);
  const records = indexes.map((index) => {
    if (!corrections.has(index) || !wrong.has(index)) {
      throw new Error(`Incomplete Find-it answer data for index ${index}.`);
    }
    return { correction: corrections.get(index), displayedWrong: wrong.get(index), clue: clues.get(index) || '' };
  });
  return { version: '3.2b', usesSecondAnswerAsWrong, records };
}

export function importFindItHtml(htmlText) {
  const sourceHtml = String(htmlText ?? '');
  const evidence = inspectFindItHtml(sourceHtml);
  if (!evidence.usesSecondAnswerAsWrong) {
    throw new Error('Find-it HTML does not use the supported second-answer display convention.');
  }
  const body = sourceHtml.match(/<div\b[^>]*\bid=["']ClozeBody["'][^>]*>([\s\S]*?)<\/div>/i)?.[1];
  if (!body) throw new Error('Supported Find-it HTML is missing the ClozeBody exercise text.');
  const used = new Set();
  const withWrongForms = body.replace(/<span\b[^>]*\bid=["']GapSpan(\d+)["'][^>]*>[\s\S]*?<\/span>/gi, (_match, rawIndex) => {
    const index = Number(rawIndex);
    const record = evidence.records[index];
    if (!record) throw new Error(`Find-it HTML references missing answer data for gap ${index}.`);
    if (used.has(index)) throw new Error(`Find-it HTML contains duplicate gap id GapSpan${index}.`);
    used.add(index);
    return escapeForText(record.displayedWrong);
  });
  if (used.size !== evidence.records.length) {
    throw new Error(`Find-it HTML contains ${evidence.records.length} answer records but ${used.size} exercise gaps.`);
  }
  const source = decodeText(withWrongForms
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(?:p|div|li|h[1-6])\s*>/gi, '\n')
    .replace(/<[^>]*>/g, ''))
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
  const errors = [];
  let cursor = 0;
  for (let index = 0; index < evidence.records.length; index += 1) {
    const record = evidence.records[index];
    const start = source.indexOf(record.displayedWrong, cursor);
    if (start < 0) throw new Error(`Displayed wrong form for HTML gap ${index} could not be placed in source order.`);
    errors.push({
      id: `error-${index + 1}`,
      start,
      end: start + record.displayedWrong.length,
      source: record.displayedWrong,
      accepted: [record.correction],
      hints: record.clue ? [record.clue] : [],
      explanation: ''
    });
    cursor = start + record.displayedWrong.length;
  }
  const duplicateForms = errors.filter((error, index) => errors.findIndex((item) => item.source === error.source) !== index);
  const warnings = duplicateForms.length ? ['Repeated displayed wrong forms were mapped by gap order; review the preview before export.'] : [];
  const rawTitle = sourceHtml.match(/<h2\b[^>]*\bclass=["'][^"']*\bExerciseTitle\b[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i)?.[1] ||
    sourceHtml.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '';
  return { schemaVersion: 1, title: decodeText(stripXmlTags(rawTitle)).trim(), source, errors: validateAnnotations(source, errors), warnings };
}

function extractJsArrayValues(source, answerIndex) {
  const result = new Map();
  const pattern = new RegExp(
    `I\\[(\\d+)\\]\\[1\\]\\[${answerIndex}\\]\\[0\\]\\s*=\\s*'((?:\\\\.|[^'])*)'`,
    'g'
  );
  let match;
  while ((match = pattern.exec(source)) !== null) {
    result.set(Number(match[1]), decodeJsString(match[2]));
  }
  return result;
}

function extractIndexedJsValues(source, fieldIndex) {
  const result = new Map();
  const pattern = new RegExp(`I\\[(\\d+)\\]\\[${fieldIndex}\\]\\s*=\\s*'((?:\\\\.|[^'])*)'`, 'g');
  let match;
  while ((match = pattern.exec(source)) !== null) result.set(Number(match[1]), decodeJsString(match[2]));
  return result;
}

function decodeJsString(value) {
  return value.replace(/\\u([0-9a-fA-F]{4})|\\x([0-9a-fA-F]{2})|\\(['"\\])/g,
    (_match, unicode, hex, escaped) => unicode
      ? String.fromCharCode(Number.parseInt(unicode, 16))
      : hex
        ? String.fromCharCode(Number.parseInt(hex, 16))
        : escaped);
}

function rejectActiveXml(source) {
  if (/<!DOCTYPE|<!ENTITY/i.test(String(source))) {
    throw new Error('DTD and entity declarations are not permitted in legacy XML.');
  }
}

function textOf(source, tag) {
  const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(source).match(new RegExp(`<${escaped}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escaped}>`, 'i'));
  return match ? stripXmlTags(match[1]).trim() : '';
}

function decodeText(value) {
  return decodeSafeEntities(decodeSafeEntities(value));
}

function escapeForText(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

