import { decodeSafeEntities } from './entities.mjs';
import { parseMarkup, serializeMarkup } from './markup.mjs';
import { validateAnnotations } from './tokenizer.mjs';

export const MODEL_PREFIX = 'FCE2\n';
export const MODEL_VERSION = 2;

const ALLOWED_TAGS = new Set(['p', 'br', 'strong', 'em', 'u', 'sub', 'sup', 'span']);

export function sanitizeRichHtml(value) {
  let html = String(value ?? '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe|object|embed|svg|math)[^>]*>[\s\S]*?<\/\1\s*>/gi, '');
  html = html.replace(/<\/?([a-z][a-z0-9-]*)([^>]*)>/gi, (match, rawName, rawAttributes) => {
    const name = rawName.toLowerCase();
    if (!ALLOWED_TAGS.has(name)) return '';
    if (match.startsWith('</')) return name === 'br' ? '' : `</${name}>`;
    if (name === 'br') return '<br>';
    if (name === 'span') {
      const id = rawAttributes.match(/\bdata-fce-id\s*=\s*["']([^"']+)["']/i)?.[1];
      return id && /^[A-Za-z0-9._:-]{1,80}$/.test(id)
        ? `<span data-fce-id="${escapeAttribute(id)}">`
        : '<span>';
    }
    return `<${name}>`;
  });
  return html;
}

export function htmlToPlainText(value) {
  return decodeSafeEntities(sanitizeRichHtml(value)
    .replace(/<br\s*>/gi, '\n')
    .replace(/<\/p\s*>\s*<p>/gi, '\n')
    .replace(/^\s*<p>/i, '')
    .replace(/<\/p>\s*$/i, '')
    .replace(/<[^>]*>/g, ''));
}

export function plainTextToHtml(source, errors = []) {
  const ordered = validateAnnotations(String(source ?? ''), errors);
  let html = '';
  let cursor = 0;
  for (const error of ordered) {
    html += escapeHtml(source.slice(cursor, error.start));
    html += `<span data-fce-id="${escapeAttribute(error.id)}">${escapeHtml(error.source)}</span>`;
    cursor = error.end;
  }
  html += escapeHtml(source.slice(cursor));
  return `<p>${html.replace(/\r?\n/g, '</p><p>')}</p>`;
}

export function parseAuthoringValue(value) {
  const input = String(value ?? '');
  if (!input.startsWith(MODEL_PREFIX)) {
    const legacy = parseMarkup(input);
    return normalizeModel({
      ...legacy,
      schemaVersion: MODEL_VERSION,
      html: plainTextToHtml(legacy.source, legacy.errors)
    });
  }
  let decoded;
  try {
    decoded = JSON.parse(input.slice(MODEL_PREFIX.length));
  }
  catch {
    throw new Error('The FCE2 authoring model is not valid JSON.');
  }
  return normalizeModel(decoded);
}

export function normalizeModel(candidate) {
  if (!candidate || typeof candidate !== 'object') throw new Error('A content model is required.');
  const source = String(candidate.source ?? '');
  const errors = (Array.isArray(candidate.errors) ? candidate.errors : []).map((error, index) => ({
    id: String(error.id || `error-${index + 1}`),
    start: Number(error.start),
    end: Number(error.end),
    source: String(error.source ?? ''),
    accepted: [...new Set((Array.isArray(error.accepted) ? error.accepted : []).map(String))],
    hints: (Array.isArray(error.hints) ? error.hints : []).map(String),
    explanation: sanitizeRichHtml(error.explanation || ''),
    maxAttempts: nonNegativeInteger(error.maxAttempts),
    points: normalizePair(error.points),
    penalties: normalizePair(error.penalties)
  }));
  validateAnnotations(source, errors);
  if (!errors.length) throw new Error('At least one error annotation is required.');
  let html = sanitizeRichHtml(candidate.html || plainTextToHtml(source, errors));
  if (htmlToPlainText(html) !== source || !hasEveryMarker(html, errors)) {
    html = plainTextToHtml(source, errors);
  }
  return { schemaVersion: MODEL_VERSION, source, html, errors };
}

export function serializeAuthoringValue(model) {
  const normalized = normalizeModel(model);
  const stable = {
    schemaVersion: MODEL_VERSION,
    source: normalized.source,
    html: normalized.html,
    errors: normalized.errors.map((error) => ({
      id: error.id,
      start: error.start,
      end: error.end,
      source: error.source,
      accepted: error.accepted,
      hints: error.hints,
      explanation: error.explanation,
      maxAttempts: error.maxAttempts,
      points: error.points,
      penalties: error.penalties
    }))
  };
  return MODEL_PREFIX + JSON.stringify(stable);
}

export function toCompactMarkup(model) {
  return serializeMarkup(normalizeModel(model));
}

export function applyCompactMarkup(markup, previousModel) {
  const parsed = parseMarkup(markup);
  const previous = previousModel ? normalizeModel(previousModel) : null;
  parsed.errors = parsed.errors.map((error, index) => {
    const prior = previous?.errors[index];
    return {
      ...error,
      id: prior?.id || error.id,
      hints: prior?.hints || [],
      explanation: prior?.explanation || '',
      maxAttempts: prior?.maxAttempts || 0,
      points: prior?.points || {},
      penalties: prior?.penalties || {}
    };
  });
  const textChanged = Boolean(previous && previous.source !== parsed.source);
  return {
    model: normalizeModel({
      ...parsed,
      schemaVersion: MODEL_VERSION,
      html: textChanged ? plainTextToHtml(parsed.source, parsed.errors) : previous?.html
    }),
    formattingReset: textChanged && Boolean(previous?.html && /<(?:strong|em|u|sub|sup)\b/i.test(previous.html))
  };
}

function hasEveryMarker(html, errors) {
  return errors.every((error) => html.includes(`data-fce-id="${escapeAttribute(error.id)}"`));
}

function normalizePair(value) {
  if (!value || typeof value !== 'object') return {};
  const result = {};
  for (const [key, raw] of Object.entries(value)) {
    const number = Number(raw);
    if (Number.isFinite(number) && number >= 0) result[key] = number;
  }
  return result;
}

function nonNegativeInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : 0;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[character]);
}

function escapeAttribute(value) {
  return String(value).replace(/[&"<>]/g, (character) => ({ '&': '&amp;', '"': '&quot;', '<': '&lt;', '>': '&gt;' })[character]);
}
