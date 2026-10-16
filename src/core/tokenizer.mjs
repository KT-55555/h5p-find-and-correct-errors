const WORD_CHAR = /[\p{L}\p{N}\p{M}]/u;
const INTERNAL = new Set(["'", '’', 'ʼ', '-']);

export function tokenize(text) {
  const source = String(text ?? '');
  const characters = Array.from(source);
  const offsets = [];
  let codeUnitOffset = 0;
  for (const character of characters) {
    offsets.push(codeUnitOffset);
    codeUnitOffset += character.length;
  }
  offsets.push(codeUnitOffset);

  const tokens = [];
  let index = 0;
  while (index < characters.length) {
    const startIndex = index;
    const character = characters[index];
    if (WORD_CHAR.test(character)) {
      index += 1;
      while (index < characters.length) {
        const current = characters[index];
        if (WORD_CHAR.test(current)) {
          index += 1;
          continue;
        }
        const next = characters[index + 1];
        if (INTERNAL.has(current) && next && WORD_CHAR.test(next)) {
          index += 1;
          continue;
        }
        break;
      }
      tokens.push(makeToken('word', source, offsets[startIndex], offsets[index]));
      continue;
    }

    const type = /\s/u.test(character) ? 'space' : 'punctuation';
    index += 1;
    while (index < characters.length) {
      const current = characters[index];
      const nextType = /\s/u.test(current) ? 'space' :
        (WORD_CHAR.test(current) ? 'word' : 'punctuation');
      if (nextType !== type) {
        break;
      }
      index += 1;
    }
    tokens.push(makeToken(type, source, offsets[startIndex], offsets[index]));
  }

  let wordIndex = 0;
  return tokens.map((token) => token.type === 'word'
    ? { ...token, id: `token-${wordIndex++}` }
    : token);
}

function makeToken(type, source, start, end) {
  return { type, start, end, text: source.slice(start, end) };
}

export function errorForToken(token, errors) {
  if (!token || token.type !== 'word') {
    return null;
  }
  return errors.find((error) => token.start < error.end && token.end > error.start) ?? null;
}

export function validateAnnotations(source, errors) {
  const ids = new Set();
  const ordered = [...errors].sort((left, right) => left.start - right.start || left.end - right.end);
  for (let index = 0; index < ordered.length; index += 1) {
    const error = ordered[index];
    if (!error.id || ids.has(error.id)) {
      throw new Error(`Error annotation ${index + 1} has a missing or duplicate id.`);
    }
    ids.add(error.id);
    if (!Number.isInteger(error.start) || !Number.isInteger(error.end) ||
      error.start < 0 || error.end <= error.start || error.end > source.length) {
      throw new Error(`Error annotation ${error.id} has an invalid range.`);
    }
    if (source.slice(error.start, error.end) !== error.source) {
      throw new Error(`Error annotation ${error.id} does not match its source range.`);
    }
    if (!Array.isArray(error.accepted) || error.accepted.length === 0 ||
      error.accepted.some((answer) => !String(answer).trim())) {
      throw new Error(`Error annotation ${error.id} needs at least one accepted correction.`);
    }
    if (index > 0 && ordered[index - 1].end > error.start) {
      throw new Error(`Error annotations ${ordered[index - 1].id} and ${error.id} overlap.`);
    }
    const intersectsWord = tokenize(source.slice(error.start, error.end)).some((token) => token.type === 'word');
    if (!intersectsWord) {
      throw new Error(`Error annotation ${error.id} must contain a word token.`);
    }
  }
  return ordered;
}

