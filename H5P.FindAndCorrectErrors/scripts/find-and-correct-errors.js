(function ($, Question) {
  'use strict';

  var DEFAULTS = {
    taskDescription: '<p>Find each error and type its correction.</p>',
    markup: 'The students [was|were] ready.',
    errorSettings: [],
    behaviour: {
      validationTiming: 'live',
      caseSensitive: false,
      collapseWhitespace: true,
      punctuation: 'preserve',
      identificationPoints: 1,
      correctionPoints: 1,
      wrongTokenPenalty: 0.5,
      incorrectCorrectionPenalty: 0,
      hintPenalty: 0,
      countDisplay: 'remaining',
      autoComplete: true,
      enableRetry: true,
      maxRetries: 0,
      enableSolutionsButton: true,
      solutionDisclosure: 'exhaustion',
      feedbackTiming: 'immediate',
      enableHints: true,
      normalizeApostrophes: false,
      displayMode: 'correct'
    },
    l10n: {
      check: 'Check',
      finish: 'Finish',
      retry: 'Retry',
      showSolution: 'Show solution',
      noError: 'No error here.',
      foundError: 'Error found. Type the correction.',
      correct: 'Correct.',
      incorrect: 'That correction is not accepted.',
      inputLabel: 'Correction for error @num of @total',
      tokenLabel: 'Check word: @word',
      remaining: 'Errors remaining: @count',
      total: 'Errors to find: @count',
      solutionPrefix: 'Solution:',
      hint: 'Hint'
    }
  };

  function FindAndCorrectErrors(params, contentId, contentData) {
    var self = this;
    Question.call(self, 'find-and-correct-errors');
    self.params = $.extend(true, {}, DEFAULTS, params || {});
    var suppliedBehaviour = params && params.behaviour || {};
    if (!Object.prototype.hasOwnProperty.call(suppliedBehaviour, 'countDisplay') && Object.prototype.hasOwnProperty.call(suppliedBehaviour, 'showRemaining')) {
      self.params.behaviour.countDisplay = suppliedBehaviour.showRemaining ? 'remaining' : 'hidden';
    }
    if (!Object.prototype.hasOwnProperty.call(suppliedBehaviour, 'solutionDisclosure') && Object.prototype.hasOwnProperty.call(suppliedBehaviour, 'revealOnExhaustion')) {
      self.params.behaviour.solutionDisclosure = suppliedBehaviour.revealOnExhaustion ? 'exhaustion' : 'completion';
    }
    self.contentId = contentId;
    self.contentData = contentData || {};
    self.model = parseMarkup(self.params.markup);
    applyErrorSettings(self.model.errors, self.params.errorSettings);
    validateMaximum(self.model.errors, self.params.behaviour);
    self.state = createState(self.model.errors, self.contentData.previousState, self.params.behaviour);
    self.targetByElement = new WeakMap();
    self.answered = Boolean(self.state.answered);
    self.solutionsVisible = Boolean(self.state.solutionsVisible);

    self.root = document.createElement('div');
    self.root.className = 'h5p-find-and-correct-errors';
    self.description = document.createElement('div');
    self.description.className = 'fce-task-description';
    self.description.innerHTML = sanitizeTaskHtml(self.params.taskDescription);
    self.text = document.createElement('div');
    self.text.className = 'fce-text';
    self.text.setAttribute('role', 'group');
    self.status = document.createElement('div');
    self.status.className = 'fce-status';
    self.status.id = 'fce-status-' + String(contentId || 'preview').replace(/[^A-Za-z0-9_-]/g, '-');
    self.status.setAttribute('role', 'status');
    self.status.setAttribute('aria-live', 'polite');
    self.status.setAttribute('aria-atomic', 'true');
    self.remaining = document.createElement('div');
    self.remaining.className = 'fce-remaining';
    self.root.appendChild(self.description);
    self.root.appendChild(self.text);
    self.root.appendChild(self.status);
    self.root.appendChild(self.remaining);
    self.setContent($(self.root));

    self.addButton('fce-check', self.params.l10n.check, function () {
      self.checkDiscovered(false);
    }, true, { 'aria-label': self.params.l10n.check });
    self.addButton('fce-finish', self.params.l10n.finish, function () {
      self.finish();
    }, true, { 'aria-label': self.params.l10n.finish });
    self.addButton('fce-solution', self.params.l10n.showSolution, function () {
      self.showSolutions();
    }, false, { 'aria-label': self.params.l10n.showSolution });
    self.addButton('fce-retry', self.params.l10n.retry, function () {
      self.resetTask();
    }, false, { 'aria-label': self.params.l10n.retry });
    self.render();
  }

  FindAndCorrectErrors.prototype = Object.create(Question.prototype);
  FindAndCorrectErrors.prototype.constructor = FindAndCorrectErrors;

  FindAndCorrectErrors.prototype.render = function (focusErrorId) {
    var self = this;
    self.text.replaceChildren();
    self.targetByElement = new WeakMap();
    self.renderRichContent();
    self.updateControls();
    if (focusErrorId) {
      var inputs = self.text.querySelectorAll('.fce-correction');
      var foundIndex = self.model.errors.filter(function (error) {
        return self.state.errors[error.id].found && !self.state.errors[error.id].corrected;
      }).findIndex(function (error) { return error.id === focusErrorId; });
      if (foundIndex >= 0 && inputs[foundIndex]) {
        inputs[foundIndex].focus();
        inputs[foundIndex].select();
      }
    }
    self.trigger('resize');
  };

  FindAndCorrectErrors.prototype.renderRichContent = function () {
    var self = this;
    var template = document.createElement('template');
    template.innerHTML = sanitizeHtml(self.model.html || plainHtml(self.model.source, self.model.errors));
    var offset = 0;
    Array.prototype.forEach.call(template.content.childNodes, function (node, index) {
      if (index > 0 && node.nodeType === 1 && node.tagName.toLowerCase() === 'p') { offset += 1; }
      offset = self.renderRichNode(node, self.text, offset);
    });
  };

  FindAndCorrectErrors.prototype.renderRichNode = function (node, parent, offset) {
    var self = this;
    if (node.nodeType === 3) {
      self.renderTokensInto(parent, node.nodeValue, offset, null);
      return offset + node.nodeValue.length;
    }
    if (node.nodeType !== 1) { return offset; }
    var name = node.tagName.toLowerCase();
    if (name === 'br') { parent.appendChild(document.createElement('br')); return offset + 1; }
    var markerId = name === 'span' ? node.getAttribute('data-fce-id') : null;
    var error = markerId && self.model.errors.find(function (item) { return item.id === markerId; });
    if (error) {
      self.renderError(parent, error);
      return offset + error.source.length;
    }
    var clone = document.createElement(name === 'span' ? 'span' : name);
    parent.appendChild(clone);
    Array.prototype.forEach.call(node.childNodes, function (child) { offset = self.renderRichNode(child, clone, offset); });
    return offset;
  };

  FindAndCorrectErrors.prototype.renderError = function (parent, error) {
    var self = this;
    var item = self.state.errors[error.id];
    var disclosure = self.params.behaviour.solutionDisclosure;
    var discloseSolution = self.solutionsVisible || item.corrected ||
      (item.exhausted && disclosure === 'exhaustion') || (self.answered && disclosure === 'completion');
    if (discloseSolution) {
      var solution = document.createElement('span');
      solution.className = item.corrected ? 'fce-corrected' : 'fce-solution';
      if (item.corrected && self.params.behaviour.displayMode === 'learner') solution.textContent = item.value;
      else if (item.corrected && self.params.behaviour.displayMode === 'original') solution.textContent = error.source;
      else solution.textContent = error.accepted[0];
      solution.setAttribute('aria-label', self.params.l10n.solutionPrefix + ' ' + error.accepted[0]);
      parent.appendChild(solution);
      var feedbackTiming = self.params.behaviour.feedbackTiming;
      if (error.explanation && feedbackTiming !== 'never' && (feedbackTiming === 'immediate' || self.answered)) {
        var explanation = document.createElement('span');
        explanation.className = 'fce-explanation';
        explanation.innerHTML = sanitizeHtml(error.explanation);
        parent.appendChild(explanation);
      }
      return;
    }
    if (item.exhausted) {
      var exhausted = document.createElement('span'); exhausted.className = 'fce-exhausted'; exhausted.textContent = error.source; parent.appendChild(exhausted); return;
    }
    if (!item.found) { self.renderTokensInto(parent, error.source, error.start, error); return; }
    var input = document.createElement('input');
    input.type = 'text'; input.className = 'fce-correction'; input.value = item.value;
    input.autocomplete = 'off'; input.spellcheck = false;
    var index = self.model.errors.indexOf(error);
    input.setAttribute('aria-label', replace(self.params.l10n.inputLabel, { num: index + 1, total: self.model.errors.length }));
    input.setAttribute('aria-describedby', self.status.id);
    input.setAttribute('aria-invalid', item.invalid ? 'true' : 'false');
    input.addEventListener('input', function () { item.value = input.value; item.invalid = false; input.setAttribute('aria-invalid', 'false'); });
    input.addEventListener('change', function () { if (self.text.contains(input) && self.params.behaviour.validationTiming === 'live') self.checkError(error); });
    input.addEventListener('keydown', function (event) { if (event.key === 'Enter' && self.text.contains(input) && self.params.behaviour.validationTiming === 'live') { event.preventDefault(); self.checkError(error); } });
    parent.appendChild(input);
    var hintText = error.hints && error.hints[item.hintsUsed] || error.hint;
    if (hintText && self.params.behaviour.enableHints) {
      var hint = document.createElement('button'); hint.type = 'button'; hint.className = 'fce-hint'; hint.textContent = self.params.l10n.hint;
      hint.addEventListener('click', function () {
        var key = 'hint:' + error.id + ':' + item.hintsUsed;
        record(self.state.ledger, key, -number(error.penalties && error.penalties.hint, self.params.behaviour.hintPenalty));
        item.hintsUsed += 1; self.announce(hintText); self.render(error.id);
      });
      parent.appendChild(hint);
    }
  };

  FindAndCorrectErrors.prototype.renderTokens = function (start, end, forcedError) {
    this.renderTokensInto(this.text, this.model.source.slice(start, end), start, forcedError);
  };

  FindAndCorrectErrors.prototype.renderTokensInto = function (parent, segment, start, forcedError) {
    var self = this;
    var wordPattern = /[\p{L}\p{N}\p{M}]+(?:['’ʼ-][\p{L}\p{N}\p{M}]+)*/gu;
    var cursor = 0;
    var match;
    while ((match = wordPattern.exec(segment)) !== null) {
      parent.appendChild(document.createTextNode(segment.slice(cursor, match.index)));
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'fce-token';
      button.textContent = match[0];
      button.setAttribute('aria-label', replace(self.params.l10n.tokenLabel, { word: match[0] }));
      var absoluteStart = start + match.index;
      var absoluteEnd = absoluteStart + match[0].length;
      var target = forcedError || self.model.errors.find(function (error) {
        return absoluteStart < error.end && absoluteEnd > error.start;
      }) || null;
      self.targetByElement.set(button, { error: target, token: 'token:' + absoluteStart + ':' + absoluteEnd });
      button.addEventListener('click', function (event) {
        self.activateToken(event.currentTarget);
      });
      parent.appendChild(button);
      cursor = match.index + match[0].length;
    }
    parent.appendChild(document.createTextNode(segment.slice(cursor)));
  };

  FindAndCorrectErrors.prototype.activateToken = function (element) {
    if (this.answered || this.solutionsVisible) {
      return;
    }
    var target = this.targetByElement.get(element);
    if (!target || !target.error) {
      if (target) {
        record(this.state.ledger, 'wrong:' + target.token, -number(this.params.behaviour.wrongTokenPenalty));
      }
      this.announce(this.params.l10n.noError);
      return;
    }
    var errorState = this.state.errors[target.error.id];
    if (!errorState.found) {
      errorState.found = true;
      errorState.value = target.error.source;
      record(this.state.ledger, 'identify:' + target.error.id, number(target.error.points && target.error.points.identification, this.params.behaviour.identificationPoints));
    }
    this.announce(this.params.l10n.foundError);
    this.render(target.error.id);
  };

  FindAndCorrectErrors.prototype.checkDiscovered = function (finishing) {
    var self = this;
    var anyIncorrect = false;
    var anyChecked = false;
    self.model.errors.forEach(function (error) {
      var item = self.state.errors[error.id];
      if (!item.found || item.corrected) {
        return;
      }
      if (item.lastCheckedValue === item.value) {
        anyIncorrect = anyIncorrect || item.invalid;
        return;
      }
      anyChecked = true;
      item.lastCheckedValue = item.value;
      item.attempts += 1;
      if (isAccepted(item.value, error.accepted, self.params.behaviour)) {
        item.corrected = true;
        item.invalid = false;
        record(self.state.ledger, 'correct:' + error.id, number(error.points && error.points.correction, self.params.behaviour.correctionPoints));
      }
      else {
        anyIncorrect = true;
        item.invalid = true;
        record(self.state.ledger, 'incorrect:' + error.id + ':' + item.attempts,
          -number(error.penalties && error.penalties.incorrectCorrection, self.params.behaviour.incorrectCorrectionPenalty));
        if (number(error.maxAttempts) > 0 && item.attempts >= number(error.maxAttempts)) item.exhausted = true;
      }
    });
    self.render();
    if (anyChecked) {
      self.announce(anyIncorrect ? self.params.l10n.incorrect : self.params.l10n.correct);
    }
    if (!finishing && self.params.behaviour.autoComplete && self.allCorrected()) {
      self.finish();
    }
  };

  FindAndCorrectErrors.prototype.checkError = function (error) {
    var item = this.state.errors[error.id];
    if (!item || item.corrected || item.exhausted) return;
    if (item.lastCheckedValue === item.value) return;
    item.lastCheckedValue = item.value;
    item.attempts += 1;
    if (isAccepted(item.value, error.accepted, this.params.behaviour)) {
      item.corrected = true; item.invalid = false;
      record(this.state.ledger, 'correct:' + error.id, number(error.points && error.points.correction, this.params.behaviour.correctionPoints));
      this.announce(this.params.l10n.correct);
    }
    else {
      item.invalid = true;
      record(this.state.ledger, 'incorrect:' + error.id + ':' + item.attempts, -number(error.penalties && error.penalties.incorrectCorrection, this.params.behaviour.incorrectCorrectionPenalty));
      if (number(error.maxAttempts) > 0 && item.attempts >= number(error.maxAttempts)) item.exhausted = true;
      this.announce(this.params.l10n.incorrect);
    }
    this.render(item.exhausted ? null : error.id);
    if (this.params.behaviour.autoComplete && this.allCorrected()) this.finish();
  };

  FindAndCorrectErrors.prototype.finish = function () {
    if (this.answered) {
      return;
    }
    this.checkDiscovered(true);
    this.answered = true;
    this.state.answered = true;
    this.state.completed = true;
    this.render();
    var score = this.getScore();
    var max = this.getMaxScore();
    this.setFeedback('', score, max);
    this.updateControls();
    this.triggerAnswered();
  };

  FindAndCorrectErrors.prototype.showSolutions = function () {
    if (this.params.behaviour.solutionDisclosure === 'never') return;
    this.solutionsVisible = true;
    this.state.solutionsVisible = true;
    this.render();
  };

  FindAndCorrectErrors.prototype.resetTask = function () {
    var retries = number(this.state.retries) + 1;
    this.state = createState(this.model.errors, null, this.params.behaviour);
    this.state.retries = retries;
    this.answered = false;
    this.solutionsVisible = false;
    this.removeFeedback();
    this.announce('');
    this.render();
  };

  FindAndCorrectErrors.prototype.updateControls = function () {
    var remaining = this.model.errors.filter(function (error) {
      return !this.state.errors[error.id].corrected;
    }, this).length;
    var countDisplay = this.params.behaviour.countDisplay;
    this.remaining.textContent = countDisplay === 'remaining'
      ? replace(this.params.l10n.remaining, { count: remaining })
      : countDisplay === 'total'
        ? replace(this.params.l10n.total, { count: this.model.errors.length })
        : '';
    (this.answered || this.solutionsVisible || this.params.behaviour.validationTiming === 'deferred') ? this.hideButton('fce-check') : this.showButton('fce-check');
    (this.answered || this.solutionsVisible) ? this.hideButton('fce-finish') : this.showButton('fce-finish');
    if (this.answered && !this.solutionsVisible && this.params.behaviour.enableSolutionsButton && this.params.behaviour.solutionDisclosure !== 'never') {
      this.showButton('fce-solution');
    }
    else {
      this.hideButton('fce-solution');
    }
    var retriesAvailable = number(this.params.behaviour.maxRetries) === 0 || number(this.state.retries) < number(this.params.behaviour.maxRetries);
    if (this.answered && !this.solutionsVisible && this.params.behaviour.enableRetry && retriesAvailable) {
      this.showButton('fce-retry');
    }
    else {
      this.hideButton('fce-retry');
    }
  };

  FindAndCorrectErrors.prototype.announce = function (message) {
    this.status.textContent = '';
    var status = this.status;
    window.setTimeout(function () { status.textContent = message; }, 20);
  };

  FindAndCorrectErrors.prototype.allCorrected = function () {
    var self = this;
    return self.model.errors.every(function (error) { return self.state.errors[error.id].corrected; });
  };

  FindAndCorrectErrors.prototype.allTerminal = function () {
    var self = this;
    return self.model.errors.every(function (error) {
      var item = self.state.errors[error.id];
      return item.corrected || item.exhausted || (number(error.maxAttempts) > 0 && item.attempts >= number(error.maxAttempts));
    });
  };

  FindAndCorrectErrors.prototype.getAnswerGiven = function () {
    var self = this;
    return self.answered || Object.keys(self.state.ledger).length > 0 || self.model.errors.some(function (error) {
      return self.state.errors[error.id].found;
    });
  };

  FindAndCorrectErrors.prototype.getMaxScore = function () {
    return this.model.errors.reduce(function (sum, error) {
      return sum + number(error.points && error.points.identification, this.params.behaviour.identificationPoints) +
        number(error.points && error.points.correction, this.params.behaviour.correctionPoints);
    }.bind(this), 0);
  };

  FindAndCorrectErrors.prototype.getScore = function () {
    var total = Object.keys(this.state.ledger).reduce(function (sum, key) {
      return sum + number(this.state.ledger[key]);
    }.bind(this), 0);
    return Math.max(0, Math.min(this.getMaxScore(), total));
  };

  FindAndCorrectErrors.prototype.getCurrentState = function () {
    return this.getAnswerGiven() ? JSON.parse(JSON.stringify(this.state)) : {};
  };

  FindAndCorrectErrors.prototype.triggerAnswered = function () {
    var event = this.createXAPIEventTemplate('answered');
    var score = this.getScore();
    var max = this.getMaxScore();
    var response = this.model.errors.map(function (error) {
      return this.state.errors[error.id].value || '';
    }, this).join('[,]');
    event.setScoredResult(score, max, this, true, score === max);
    event.data.statement.result.response = response;
    event.data.statement.result.completion = true;
    enrichDefinition(event.data.statement, this);
    this.trigger(event);
    var completed = this.createXAPIEventTemplate('completed');
    completed.setScoredResult(score, max, this, true, score === max);
    completed.data.statement.result.response = response;
    completed.data.statement.result.completion = true;
    enrichDefinition(completed.data.statement, this);
    this.trigger(completed);
  };

  FindAndCorrectErrors.prototype.remove = function () {
    this.root.replaceChildren();
  };

  FindAndCorrectErrors.prototype.getXAPIData = function () {
    var event = this.createXAPIEventTemplate('answered');
    var score = this.getScore();
    var max = this.getMaxScore();
    event.setScoredResult(score, max, this, true, score === max);
    event.data.statement.result.response = this.model.errors.map(function (error) { return this.state.errors[error.id].value || ''; }, this).join('[,]');
    event.data.statement.result.completion = Boolean(this.state.completed);
    enrichDefinition(event.data.statement, this);
    return { statement: event.data.statement };
  };

  function parseMarkup(input) {
    if (String(input).indexOf('FCE2\n') === 0) {
      var decoded;
      try { decoded = JSON.parse(decodeEntities(String(input).slice(5))); }
      catch (error) { throw new Error('Invalid FCE2 authoring model.'); }
      if (!decoded || decoded.schemaVersion !== 2 || !Array.isArray(decoded.errors) || !decoded.source) throw new Error('Unsupported FCE2 authoring model.');
      decoded.errors.forEach(function (error) {
        if (decoded.source.slice(error.start, error.end) !== error.source || !Array.isArray(error.accepted) || !error.accepted.length) throw new Error('Invalid FCE2 annotation.');
        error.hints = Array.isArray(error.hints) ? error.hints.map(String) : [];
        error.explanation = sanitizeHtml(error.explanation || '');
        error.maxAttempts = Math.max(0, parseInt(error.maxAttempts, 10) || 0);
      });
      decoded.errors.sort(function (left, right) { return left.start - right.start || left.end - right.end; });
      var ids = {};
      decoded.errors.forEach(function (error, index) {
        if (!error.id || ids[error.id] || index > 0 && decoded.errors[index - 1].end > error.start) throw new Error('Invalid overlapping or duplicate FCE2 annotation.');
        ids[error.id] = true;
      });
      decoded.html = sanitizeHtml(decoded.html || plainHtml(decoded.source, decoded.errors));
      if (htmlText(decoded.html) !== decoded.source) decoded.html = plainHtml(decoded.source, decoded.errors);
      return decoded;
    }
    var source = '';
    var errors = [];
    var index = 0;
    while (index < input.length) {
      if (input[index] === '\\') {
        if (index + 1 >= input.length || '\\[]|'.indexOf(input[index + 1]) < 0) {
          throw new Error('Invalid markup escape at character ' + (index + 1));
        }
        source += input[index + 1];
        index += 2;
      }
      else if (input[index] !== '[') {
        source += input[index++];
      }
      else {
        var opening = index++;
        var fields = [''];
        var closed = false;
        while (index < input.length) {
          if (input[index] === '\\') {
            if (index + 1 >= input.length) { throw new Error('Trailing markup escape'); }
            fields[fields.length - 1] += input[index + 1];
            index += 2;
          }
          else if (input[index] === ']') {
            closed = true;
            index += 1;
            break;
          }
          else if (input[index] === '|') {
            if (input[index + 1] === '|' && fields.length > 1) {
              fields.push('');
              index += 2;
            }
            else if (fields.length === 1) {
              fields.push('');
              index += 1;
            }
            else {
              throw new Error('Invalid answer separator at character ' + (index + 1));
            }
          }
          else {
            fields[fields.length - 1] += input[index++];
          }
        }
        if (!closed || fields.length < 2 || !fields[0] || fields.slice(1).some(function (field) { return !field.trim(); })) {
          throw new Error('Invalid annotation at character ' + (opening + 1));
        }
        var start = source.length;
        source += fields[0];
        errors.push({
          id: 'error-' + (errors.length + 1),
          start: start,
          end: source.length,
          source: fields[0],
          accepted: fields.slice(1)
        });
      }
    }
    if (!errors.length) {
      throw new Error('At least one error annotation is required.');
    }
    return { source: source, errors: errors, html: plainHtml(source, errors), schemaVersion: 2 };
  }

  function decodeEntities(value) {
    var textarea = document.createElement('textarea');
    textarea.innerHTML = value;
    return textarea.value;
  }

  function applyErrorSettings(errors, settings) {
    (settings || []).forEach(function (wrapper) {
      var setting = wrapper.setting || wrapper;
      var error = errors[number(setting.errorNumber) - 1];
      if (error) {
        if (!error.hints || !error.hints.length) error.hints = setting.hint ? [setting.hint] : [];
        if (!error.explanation) error.explanation = setting.explanation || '';
        if (!error.maxAttempts) error.maxAttempts = number(setting.maxAttempts);
      }
    });
  }

  function validateMaximum(errors, behaviour) {
    var max = errors.reduce(function (sum, error) {
      return sum + number(error.points && error.points.identification, behaviour.identificationPoints) +
        number(error.points && error.points.correction, behaviour.correctionPoints);
    }, 0);
    if (!(max > 0)) {
      throw new Error('Maximum score must be greater than zero.');
    }
  }

  function createState(errors, previous, behaviour) {
    var validPrevious = previous && (previous.version === 1 || previous.version === 2 || previous.version === 3) && previous.errors && previous.ledger;
    var state = validPrevious ? JSON.parse(JSON.stringify(previous)) : {
      version: 3,
      errors: {},
      ledger: {},
      answered: false,
      completed: false,
      solutionsVisible: false,
      status: '',
      retries: 0
    };
    state.version = 3;
    state.completed = Boolean(state.completed || state.answered);
    state.retries = Math.max(0, parseInt(state.retries, 10) || 0);
    errors.forEach(function (error) {
      if (!state.errors[error.id]) {
        state.errors[error.id] = {
          found: false,
          corrected: false,
          value: '',
          attempts: 0,
          hintsUsed: 0,
          exhausted: false,
          invalid: false,
          lastCheckedValue: null
        };
      }
      else {
        var item = state.errors[error.id];
        item.found = Boolean(item.found); item.corrected = Boolean(item.corrected);
        item.value = typeof item.value === 'string' ? item.value : '';
        item.attempts = Math.max(0, parseInt(item.attempts, 10) || 0);
        item.hintsUsed = Math.max(0, parseInt(item.hintsUsed, 10) || (item.hintUsed ? 1 : 0));
        item.exhausted = Boolean(item.exhausted);
        item.invalid = Boolean(item.invalid);
        item.lastCheckedValue = typeof item.lastCheckedValue === 'string' ? item.lastCheckedValue : null;
        delete item.hintUsed;
      }
    });
    var cleanLedger = {};
    Object.keys(state.ledger || {}).forEach(function (key) {
      var expected = expectedLedgerValue(key, errors, behaviour || DEFAULTS.behaviour);
      if (expected !== null && Number(state.ledger[key]) === expected && ledgerSequenceIsValid(key, state.errors)) cleanLedger[key] = expected;
    });
    state.ledger = cleanLedger;
    errors.forEach(function (error) {
      var item = state.errors[error.id];
      item.found = item.found && Object.prototype.hasOwnProperty.call(cleanLedger, 'identify:' + error.id);
      item.corrected = item.corrected && Object.prototype.hasOwnProperty.call(cleanLedger, 'correct:' + error.id);
      item.exhausted = Boolean(!item.corrected && item.exhausted && number(error.maxAttempts) > 0 && item.attempts >= number(error.maxAttempts));
      item.hintsUsed = Math.min(item.hintsUsed, (error.hints || []).length);
    });
    return state;
  }

  function ledgerSequenceIsValid(key, errorStates) {
    var match = key.match(/^(incorrect|hint):([^:]+):(\d+)$/);
    if (!match) return true;
    var item = errorStates[match[2]];
    if (!item) return false;
    return match[1] === 'incorrect' ? number(match[3]) <= item.attempts : number(match[3]) < item.hintsUsed;
  }

  function expectedLedgerValue(key, errors, behaviour) {
    if (/^wrong:token:\d+:\d+$/.test(key)) return -number(behaviour.wrongTokenPenalty);
    for (var index = 0; index < errors.length; index += 1) {
      var error = errors[index];
      if (key === 'identify:' + error.id) return number(error.points && error.points.identification, behaviour.identificationPoints);
      if (key === 'correct:' + error.id) return number(error.points && error.points.correction, behaviour.correctionPoints);
      if (key.indexOf('incorrect:' + error.id + ':') === 0 && /:\d+$/.test(key)) return -number(error.penalties && error.penalties.incorrectCorrection, behaviour.incorrectCorrectionPenalty);
      if (key.indexOf('hint:' + error.id + ':') === 0 && /:\d+$/.test(key)) return -number(error.penalties && error.penalties.hint, behaviour.hintPenalty);
      if (key === 'hint:' + error.id) return -number(error.penalties && error.penalties.hint, behaviour.hintPenalty);
    }
    return null;
  }

  function isAccepted(value, accepted, behaviour) {
    var candidate = normalize(value, behaviour);
    return accepted.some(function (answer) { return normalize(answer, behaviour) === candidate; });
  }

  function normalize(value, behaviour) {
    var output = String(value || '').normalize('NFC').trim();
    if (behaviour.collapseWhitespace) { output = output.replace(/\s+/gu, ' '); }
    if (behaviour.punctuation === 'ignore-terminal') { output = output.replace(/[\p{P}\p{S}]+$/gu, '').trimEnd(); }
    if (behaviour.normalizeApostrophes) { output = output.replace(/[’ʼ]/gu, "'"); }
    if (!behaviour.caseSensitive) { output = output.toLocaleLowerCase(); }
    return output;
  }

  function record(ledger, key, points) {
    if (Object.prototype.hasOwnProperty.call(ledger, key)) { return false; }
    ledger[key] = points;
    return true;
  }

  function replace(template, values) {
    return Object.keys(values).reduce(function (output, key) {
      return output.replace(new RegExp('@' + key, 'g'), values[key]);
    }, template);
  }

  function number(value, fallback) {
    return Number.isFinite(Number(value)) ? Number(value) : (Number.isFinite(Number(fallback)) ? Number(fallback) : 0);
  }

  function enrichDefinition(statement, instance) {
    var definition = statement.object.definition = statement.object.definition || {};
    definition.interactionType = 'fill-in';
    definition.description = definition.description || { 'en-US': instance.model.source };
    definition.correctResponsesPattern = [instance.model.errors.map(function (error) { return error.accepted[0]; }).join('[,]')];
  }

  function sanitizeHtml(value) {
    var allowed = ['p', 'br', 'strong', 'em', 'u', 'sub', 'sup', 'span'];
    return String(value || '').replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|iframe|object|embed|svg|math)[^>]*>[\s\S]*?<\/\1\s*>/gi, '').replace(/<\/?([a-z][a-z0-9-]*)([^>]*)>/gi, function (match, raw, attrs) {
      var name = raw.toLowerCase(); if (allowed.indexOf(name) < 0) return ''; if (match.indexOf('</') === 0) return name === 'br' ? '' : '</' + name + '>'; if (name === 'br') return '<br>';
      if (name === 'span') { var found = attrs.match(/\bdata-fce-id\s*=\s*["']([^"']+)["']/i); return found && /^[A-Za-z0-9._:-]{1,80}$/.test(found[1]) ? '<span data-fce-id="' + found[1] + '">' : '<span>'; }
      return '<' + name + '>';
    });
  }

  function sanitizeTaskHtml(value) {
    var allowed = ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li'];
    return String(value || '').replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|iframe|object|embed|svg|math)[^>]*>[\s\S]*?<\/\1\s*>/gi, '').replace(/<\/?([a-z][a-z0-9-]*)[^>]*>/gi, function (match, raw) {
      var name = raw.toLowerCase(); if (allowed.indexOf(name) < 0) return ''; if (match.indexOf('</') === 0) return name === 'br' ? '' : '</' + name + '>'; return name === 'br' ? '<br>' : '<' + name + '>';
    });
  }

  function htmlText(html) { var holder = document.createElement('div'); holder.innerHTML = sanitizeHtml(html).replace(/<br\s*>/gi, '\n').replace(/<\/p\s*>\s*<p>/gi, '\n').replace(/^\s*<p>/i, '').replace(/<\/p>\s*$/i, ''); return holder.textContent; }
  function plainHtml(source, errors) {
    var output = '', cursor = 0;
    errors.forEach(function (error) { output += escapeHtml(source.slice(cursor, error.start)); output += '<span data-fce-id="' + escapeHtml(error.id) + '">' + escapeHtml(error.source) + '</span>'; cursor = error.end; });
    return '<p>' + (output + escapeHtml(source.slice(cursor))).replace(/\r?\n/g, '</p><p>') + '</p>';
  }
  function escapeHtml(value) { return String(value).replace(/[&<>"']/g, function (character) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]; }); }

  H5P.FindAndCorrectErrors = FindAndCorrectErrors;
})(H5P.jQuery, H5P.Question);

