import { validateAnnotations } from './tokenizer.mjs';

export class MarkupSyntaxError extends Error {
  constructor(message, offset) {
    super(`${message} at character ${offset + 1}.`);
    this.name = 'MarkupSyntaxError';
    this.offset = offset;
  }
}

export function parseMarkup(markup) {
  const input = String(markup ?? '');
  let source = '';
  const errors = [];

  for (let index = 0; index < input.length;) {
    if (input[index] === '\\') {
      const escaped = readEscape(input, index);
      source += escaped.value;
      index = escaped.next;
      continue;
    }
    if (input[index] !== '[') {
      source += input[index];
      index += 1;
      continue;
    }

    const annotationStart = index;
    const parts = [''];
    index += 1;
    let closed = false;
    while (index < input.length) {
      if (input[index] === '\\') {
        const escaped = readEscape(input, index);
        parts[parts.length - 1] += escaped.value;
        index = escaped.next;
        continue;
      }
      if (input[index] === ']') {
        closed = true;
        index += 1;
        break;
      }
      if (input[index] === '|') {
        if (input[index + 1] === '|') {
          if (parts.length < 2) {
            throw new MarkupSyntaxError('Multiple-answer separator appears before the first answer', index);
          }
          parts.push('');
          index += 2;
          continue;
        }
        if (parts.length > 1) {
          throw new MarkupSyntaxError('Use || between additional accepted answers', index);
        }
        parts.push('');
        index += 1;
        continue;
      }
      if (input[index] === '[') {
        throw new MarkupSyntaxError('Nested annotations are not allowed', index);
      }
      parts[parts.length - 1] += input[index];
      index += 1;
    }

    if (!closed) {
      throw new MarkupSyntaxError('Unclosed annotation', annotationStart);
    }
    if (parts.length < 2 || !parts[0] || parts.slice(1).some((part) => !part.trim())) {
      throw new MarkupSyntaxError('Annotation must contain source and correction', annotationStart);
    }

    const start = source.length;
    source += parts[0];
    errors.push({
      id: `error-${errors.length + 1}`,
      start,
      end: source.length,
      source: parts[0],
      accepted: parts.slice(1),
      hints: [],
      explanation: ''
    });
  }

  validateAnnotations(source, errors);
  return { schemaVersion: 1, source, errors };
}

function readEscape(input, index) {
  if (index + 1 >= input.length) {
    throw new MarkupSyntaxError('Trailing escape', index);
  }
  const value = input[index + 1];
  if (!['\\', '[', ']', '|'].includes(value)) {
    throw new MarkupSyntaxError(`Unsupported escape \\${value}`, index);
  }
  return { value, next: index + 2 };
}

export function serializeMarkup(model) {
  const errors = validateAnnotations(model.source, model.errors);
  let output = '';
  let cursor = 0;
  for (const error of errors) {
    output += escapeLiteral(model.source.slice(cursor, error.start));
    output += `[${escapeField(error.source)}|${error.accepted.map(escapeField).join('||')}]`;
    cursor = error.end;
  }
  return output + escapeLiteral(model.source.slice(cursor));
}

function escapeLiteral(value) {
  return value.replace(/[\\[]/g, (character) => `\\${character}`);
}

function escapeField(value) {
  return String(value).replace(/[\\\[\]|]/g, (character) => `\\${character}`);
}

