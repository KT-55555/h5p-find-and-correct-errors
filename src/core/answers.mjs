export const DEFAULT_ANSWER_POLICY = Object.freeze({
  caseSensitive: false,
  trim: true,
  collapseWhitespace: true,
  punctuation: 'preserve',
  normalizeApostrophes: false,
  unicodeNormalization: 'NFC'
});

export function normalizeAnswer(value, policy = {}) {
  const settings = { ...DEFAULT_ANSWER_POLICY, ...policy };
  let output = String(value ?? '');
  if (settings.unicodeNormalization !== 'none') {
    output = output.normalize(settings.unicodeNormalization);
  }
  if (settings.trim) {
    output = output.trim();
  }
  if (settings.collapseWhitespace) {
    output = output.replace(/\s+/gu, ' ');
  }
  if (settings.punctuation === 'ignore-terminal') {
    output = output.replace(/[\p{P}\p{S}]+$/gu, '').trimEnd();
  }
  if (settings.normalizeApostrophes) {
    output = output.replace(/[’ʼ]/gu, "'");
  }
  if (!settings.caseSensitive) {
    output = output.toLocaleLowerCase(settings.locale);
  }
  return output;
}

export function isAcceptedAnswer(value, accepted, policy = {}) {
  const normalized = normalizeAnswer(value, policy);
  return accepted.some((answer) => normalizeAnswer(answer, policy) === normalized);
}

