const XML_ENTITIES = Object.freeze({
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'"
});

export function decodeSafeEntities(value, maxPasses = 4) {
  let output = String(value ?? '');
  for (let pass = 0; pass < maxPasses; pass += 1) {
    const decoded = output.replace(
      /&(?:#x([0-9a-fA-F]{1,6})|#([0-9]{1,7})|([A-Za-z]+));/g,
      (match, hex, decimal, named) => {
        if (hex !== undefined) {
          const codePoint = Number.parseInt(hex, 16);
          return validCodePoint(codePoint) ? String.fromCodePoint(codePoint) : match;
        }
        if (decimal !== undefined) {
          const codePoint = Number.parseInt(decimal, 10);
          return validCodePoint(codePoint) ? String.fromCodePoint(codePoint) : match;
        }
        return Object.hasOwn(XML_ENTITIES, named) ? XML_ENTITIES[named] : match;
      }
    );
    if (decoded === output) {
      break;
    }
    output = decoded;
  }
  return output;
}

function validCodePoint(value) {
  return Number.isInteger(value) && value > 0 && value <= 0x10ffff &&
    !(value >= 0xd800 && value <= 0xdfff);
}

export function stripXmlTags(value) {
  return String(value ?? '').replace(/<[^>]*>/g, '');
}

