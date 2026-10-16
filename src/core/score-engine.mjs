const DEFAULT_POLICY = Object.freeze({
  identificationPoints: 1,
  correctionPoints: 1,
  wrongTokenPenalty: 0.5,
  incorrectCorrectionPenalty: 0,
  hintPenalty: 0
});

export class ScoreEngine {
  constructor(errors, policy = {}, previousState = undefined) {
    this.errors = new Map(errors.map((error) => [error.id, error]));
    this.policy = { ...DEFAULT_POLICY, ...policy };
    this.validatePolicy();
    this.ledger = new Map();
    this.attempts = new Map();
    if (previousState) {
      this.restore(previousState);
    }
  }

  validatePolicy() {
    const positiveMaximum = [...this.errors.values()].reduce((sum, error) =>
      sum + numberOr(error.points?.identification, this.policy.identificationPoints) +
      numberOr(error.points?.correction, this.policy.correctionPoints), 0);
    if (!(positiveMaximum > 0)) {
      throw new Error('Maximum score must be greater than zero.');
    }
    for (const [name, value] of Object.entries(this.policy)) {
      if (!Number.isFinite(value) || value < 0) {
        throw new Error(`Scoring policy ${name} must be a non-negative number.`);
      }
    }
  }

  identify(errorId) {
    this.requireError(errorId);
    return this.record(`identify:${errorId}`, this.pointsFor(errorId, 'identification'));
  }

  correct(errorId) {
    this.requireError(errorId);
    if (this.ledger.has(`correct:${errorId}`)) {
      return false;
    }
    this.incrementAttempt(errorId);
    return this.record(`correct:${errorId}`, this.pointsFor(errorId, 'correction'));
  }

  incorrectCorrection(errorId) {
    this.requireError(errorId);
    const attempt = this.incrementAttempt(errorId);
    return this.record(
      `incorrect:${errorId}:${attempt}`,
      -numberOr(this.errors.get(errorId).penalties?.incorrectCorrection,
        this.policy.incorrectCorrectionPenalty)
    );
  }

  wrongToken(tokenId) {
    if (!tokenId) {
      throw new Error('A stable token id is required for wrong-click scoring.');
    }
    return this.record(`wrong-token:${tokenId}`, -this.policy.wrongTokenPenalty);
  }

  useHint(errorId, hintIndex = 0) {
    this.requireError(errorId);
    return this.record(`hint:${errorId}:${hintIndex}`, -this.policy.hintPenalty);
  }

  record(key, points) {
    if (this.ledger.has(key)) {
      return false;
    }
    this.ledger.set(key, points);
    return true;
  }

  incrementAttempt(errorId) {
    const next = (this.attempts.get(errorId) ?? 0) + 1;
    this.attempts.set(errorId, next);
    return next;
  }

  pointsFor(errorId, component) {
    return numberOr(this.errors.get(errorId).points?.[component], this.policy[`${component}Points`]);
  }

  requireError(errorId) {
    if (!this.errors.has(errorId)) {
      throw new Error(`Unknown error id: ${errorId}`);
    }
  }

  getMaxScore() {
    return [...this.errors.keys()].reduce((sum, id) =>
      sum + this.pointsFor(id, 'identification') + this.pointsFor(id, 'correction'), 0);
  }

  getRawScore() {
    const sum = [...this.ledger.values()].reduce((total, points) => total + points, 0);
    return Math.min(this.getMaxScore(), Math.max(0, sum));
  }

  getXapiScore() {
    const max = this.getMaxScore();
    const raw = this.getRawScore();
    return { min: 0, max, raw, scaled: raw / max };
  }

  getState() {
    return {
      version: 1,
      ledger: Object.fromEntries(this.ledger),
      attempts: Object.fromEntries(this.attempts)
    };
  }

  restore(state) {
    if (state.version !== 1 || !state.ledger || !state.attempts) {
      throw new Error('Unsupported score state.');
    }
    for (const [key, value] of Object.entries(state.ledger)) {
      if (!Number.isFinite(value)) {
        throw new Error('Invalid score ledger entry.');
      }
      this.ledger.set(key, value);
    }
    for (const [key, value] of Object.entries(state.attempts)) {
      if (!this.errors.has(key) || !Number.isInteger(value) || value < 0) {
        throw new Error('Invalid attempt state.');
      }
      this.attempts.set(key, value);
    }
  }
}

function numberOr(value, fallback) {
  return Number.isFinite(value) ? value : fallback;
}

