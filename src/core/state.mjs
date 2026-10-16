export const STATE_VERSION = 3;

export function createRuntimeState(errors, previousState) {
  const fresh = {
    version: STATE_VERSION,
    errors: {},
    ledger: {},
    wrongFragments: {},
    answered: false,
    completed: false,
    solutionsVisible: false,
    status: '',
    retries: 0
  };
  for (const error of errors) fresh.errors[error.id] = emptyErrorState();
  if (!previousState || typeof previousState !== 'object') return fresh;
  const migrated = previousState.version === 1 ? migrateV1(previousState) :
    previousState.version === 2 ? { ...previousState, version: STATE_VERSION, retries: 0 } : previousState;
  if (migrated.version !== STATE_VERSION) return fresh;
  fresh.answered = Boolean(migrated.answered);
  fresh.completed = Boolean(migrated.completed || migrated.answered);
  fresh.solutionsVisible = Boolean(migrated.solutionsVisible);
  fresh.status = typeof migrated.status === 'string' ? migrated.status : '';
  fresh.retries = nonNegativeInteger(migrated.retries);
  for (const error of errors) {
    const item = migrated.errors?.[error.id];
    if (!item || typeof item !== 'object') continue;
    fresh.errors[error.id] = {
      found: Boolean(item.found),
      corrected: Boolean(item.corrected),
      exhausted: Boolean(item.exhausted),
      value: typeof item.value === 'string' ? item.value : '',
      attempts: nonNegativeInteger(item.attempts),
      hintsUsed: nonNegativeInteger(item.hintsUsed ?? (item.hintUsed ? 1 : 0)),
      invalid: Boolean(item.invalid),
      feedback: typeof item.feedback === 'string' ? item.feedback : '',
      lastCheckedValue: typeof item.lastCheckedValue === 'string' ? item.lastCheckedValue : null
    };
  }
  for (const [key, value] of Object.entries(migrated.ledger || {})) {
    if (validLedgerKey(key, errors) && Number.isFinite(value)) fresh.ledger[key] = value;
  }
  for (const [key, value] of Object.entries(migrated.wrongFragments || {})) {
    if (/^token:\d+:\d+$/.test(key) && value === true) fresh.wrongFragments[key] = true;
  }
  return fresh;
}

export function isErrorTerminal(error, item) {
  const limit = nonNegativeInteger(error.maxAttempts);
  return Boolean(item.corrected || item.exhausted || (limit > 0 && item.attempts >= limit));
}

export function isTaskTerminal(errors, state) {
  return errors.every((error) => isErrorTerminal(error, state.errors[error.id] || emptyErrorState()));
}

export function emptyErrorState() {
  return { found: false, corrected: false, exhausted: false, value: '', attempts: 0, hintsUsed: 0, invalid: false, feedback: '', lastCheckedValue: null };
}

function migrateV1(previous) {
  return { ...previous, version: STATE_VERSION, completed: Boolean(previous.answered), wrongFragments: {} };
}

function validLedgerKey(key, errors) {
  const ids = new Set(errors.map((error) => error.id));
  if (/^wrong:token:\d+:\d+$/.test(key)) return true;
  const match = key.match(/^(identify|correct|incorrect|hint):([^:]+)(?::\d+)?$/);
  return Boolean(match && ids.has(match[2]));
}

function nonNegativeInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : 0;
}
