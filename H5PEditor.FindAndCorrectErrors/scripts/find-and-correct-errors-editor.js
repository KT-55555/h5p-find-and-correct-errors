(function ($) {
  'use strict';

  var PREFIX = 'FCE2\n';
  var ALLOWED = ['p', 'br', 'strong', 'em', 'u', 'sub', 'sup', 'span'];
  var FALLBACK = {
    visual: 'Visual', markup: 'Markup', bold: 'Bold', italic: 'Italic', mark: 'Mark as error',
    apply: 'Apply markup', targets: 'Error annotations', accepted: 'Accepted corrections (one per line)',
    hints: 'Hints (one per line)', feedback: 'Explanation / feedback', attempts: 'Maximum attempts (0 means unlimited)',
    identificationPoints: 'Identification points (blank = global)', correctionPoints: 'Correction points (blank = global)',
    incorrectPenalty: 'Incorrect-attempt penalty (blank = global)', hintPenalty: 'Hint penalty (blank = global)',
    move: 'Move annotation', remove: 'Delete annotation', empty: 'Select an annotation to edit its details.',
    selectionError: 'Select a word or contiguous phrase inside one paragraph. Nested or overlapping annotations are not allowed.',
    formatWarning: 'This markup edit changes the text. Applying it will reset inline formatting; annotation metadata will be preserved by order. Click Apply markup again to confirm.',
    invalid: 'Fix the markup error before returning to visual mode.',
    required: 'Every annotation needs at least one accepted correction.'
  };

  H5PEditor.widgets.findAndCorrectErrors = H5PEditor.FindAndCorrectErrors = function (parent, field, params, setValue) {
    this.parent = parent;
    this.field = field;
    this.params = params || field.default || 'The students [was|were] ready.';
    this.setValue = setValue;
    this.model = parseValue(this.params);
    this.selectedId = null;
    this.pendingMoveId = null;
    this.pendingConfirmation = null;
  };

  H5PEditor.FindAndCorrectErrors.prototype.appendTo = function ($wrapper) {
    var self = this;
    self.container = element('div', 'h5peditor-fce');
    self.container.setAttribute('role', 'group');
    self.container.setAttribute('aria-label', self.field.label || 'Find and Correct Errors');
    var tabs = element('div', 'h5peditor-fce__tabs');
    tabs.setAttribute('role', 'tablist');
    self.visualTab = button(t('visual'), 'h5peditor-fce__tab', function () { self.showVisual(); });
    self.markupTab = button(t('markup'), 'h5peditor-fce__tab', function () { self.showMarkup(); });
    self.visualTab.setAttribute('role', 'tab');
    self.markupTab.setAttribute('role', 'tab');
    self.visualTab.setAttribute('aria-selected', 'true');
    self.markupTab.setAttribute('aria-selected', 'false');
    tabs.append(self.visualTab, self.markupTab);
    self.toolbar = element('div', 'h5peditor-fce__toolbar');
    self.toolbar.append(
      button(t('bold'), '', function () { document.execCommand('bold'); self.syncVisual(); }),
      button(t('italic'), '', function () { document.execCommand('italic'); self.syncVisual(); }),
      button(t('mark'), '', function () { self.markSelection(); })
    );
    self.visual = element('div', 'h5peditor-fce__visual');
    self.visual.contentEditable = 'true';
    self.visual.setAttribute('role', 'textbox');
    self.visual.setAttribute('aria-multiline', 'true');
    self.visual.setAttribute('aria-label', (self.field.label || 'Find and Correct Errors') + ' visual editor');
    self.visual.innerHTML = sanitizeHtml(self.model.html);
    self.visual.addEventListener('input', function () { self.syncVisual(); });
    self.visual.addEventListener('click', function (event) {
      var marker = event.target.closest('[data-fce-id]');
      if (marker && self.visual.contains(marker)) self.selectTarget(marker.getAttribute('data-fce-id'));
    });
    self.markupPanel = element('div', 'h5peditor-fce__markup-panel');
    self.markup = element('textarea', 'h5peditor-fce__markup');
    self.markup.setAttribute('aria-label', (self.field.label || 'Find and Correct Errors') + ' markup editor');
    self.markup.value = compact(self.model);
    self.applyButton = button(t('apply'), '', function () { self.applyMarkup(); });
    self.markupPanel.append(self.markup, self.applyButton);
    self.markupPanel.hidden = true;
    self.warning = element('div', 'h5peditor-fce__warning');
    self.warning.setAttribute('role', 'alert');
    self.details = element('fieldset', 'h5peditor-fce__details');
    self.detailsLegend = element('legend');
    self.detailsLegend.textContent = t('targets');
    self.detailsBody = element('div');
    self.details.append(self.detailsLegend, self.detailsBody);
    self.container.append(tabs, self.toolbar, self.visual, self.markupPanel, self.warning, self.details);
    $wrapper.get(0).appendChild(self.container);
    self.renderDetails();
    self.commit();
  };

  H5PEditor.FindAndCorrectErrors.prototype.showMarkup = function () {
    try { this.syncVisual(); }
    catch (error) { return this.warn(error.message); }
    this.markup.value = compact(this.model);
    this.visual.hidden = true; this.toolbar.hidden = true; this.details.hidden = true;
    this.markupPanel.hidden = false;
    this.visualTab.setAttribute('aria-selected', 'false'); this.markupTab.setAttribute('aria-selected', 'true');
    this.markup.focus();
  };

  H5PEditor.FindAndCorrectErrors.prototype.showVisual = function () {
    if (!this.markupPanel.hidden && !this.applyMarkup()) return;
    this.visual.hidden = false; this.toolbar.hidden = false; this.details.hidden = false;
    this.markupPanel.hidden = true;
    this.visualTab.setAttribute('aria-selected', 'true'); this.markupTab.setAttribute('aria-selected', 'false');
    this.visual.focus();
  };

  H5PEditor.FindAndCorrectErrors.prototype.applyMarkup = function () {
    var parsed;
    try { parsed = parseMarkup(this.markup.value); }
    catch (error) { this.pendingConfirmation = null; this.warn(t('invalid') + ' ' + error.message); return false; }
    var changed = parsed.source !== this.model.source;
    var hasFormatting = /<(strong|em|u|sub|sup)\b/i.test(this.model.html);
    if (changed && hasFormatting && this.pendingConfirmation !== this.markup.value) {
      this.pendingConfirmation = this.markup.value;
      this.warn(t('formatWarning'));
      return false;
    }
    parsed.errors.forEach(function (error, index) {
      var old = this.model.errors[index];
      error.id = old ? old.id : uniqueId();
      error.hints = old ? old.hints : [];
      error.explanation = old ? old.explanation : '';
      error.maxAttempts = old ? old.maxAttempts : 0;
      error.points = old ? old.points : {};
      error.penalties = old ? old.penalties : {};
    }, this);
    parsed.html = changed ? plainHtml(parsed.source, parsed.errors) : this.model.html;
    this.model = parsed;
    this.visual.innerHTML = sanitizeHtml(this.model.html);
    this.pendingConfirmation = null;
    this.warn('');
    this.commit();
    this.renderDetails();
    return true;
  };

  H5PEditor.FindAndCorrectErrors.prototype.markSelection = function () {
    var selection = window.getSelection();
    if (!selection || selection.rangeCount !== 1 || selection.isCollapsed) return this.warn(t('selectionError'));
    var range = selection.getRangeAt(0);
    if (!this.visual.contains(range.commonAncestorContainer)) return this.warn(t('selectionError'));
    var markers = this.visual.querySelectorAll('[data-fce-id]');
    for (var index = 0; index < markers.length; index += 1) {
      if (range.intersectsNode(markers[index])) return this.warn(t('selectionError'));
    }
    var text = range.toString();
    if (!/[\p{L}\p{N}\p{M}]/u.test(text) || /\n/.test(text)) return this.warn(t('selectionError'));
    var marker = document.createElement('span');
    var id = this.pendingMoveId || uniqueId();
    marker.setAttribute('data-fce-id', id);
    try { range.surroundContents(marker); }
    catch (error) { return this.warn(t('selectionError')); }
    if (!this.model.errors.some(function (item) { return item.id === id; })) {
      this.model.errors.push({ id: id, accepted: [], hints: [], explanation: '', maxAttempts: 0, points: {}, penalties: {} });
    }
    this.pendingMoveId = null;
    this.syncVisual();
    this.selectTarget(id);
  };

  H5PEditor.FindAndCorrectErrors.prototype.syncVisual = function () {
    var self = this;
    var clean = sanitizeHtml(self.visual.innerHTML);
    self.visual.innerHTML = clean;
    var source = htmlText(clean);
    var byId = {};
    self.model.errors.forEach(function (error) { byId[error.id] = error; });
    var errors = [];
    self.visual.querySelectorAll('[data-fce-id]').forEach(function (marker) {
      var id = marker.getAttribute('data-fce-id');
      var start = prefixText(self.visual, marker, false).length;
      var end = prefixText(self.visual, marker, true).length;
      var old = byId[id] || { accepted: [], hints: [], explanation: '', maxAttempts: 0, points: {}, penalties: {} };
      errors.push({ id: id, start: start, end: end, source: source.slice(start, end), accepted: old.accepted || [], hints: old.hints || [], explanation: old.explanation || '', maxAttempts: old.maxAttempts || 0, points: old.points || {}, penalties: old.penalties || {} });
    });
    errors.sort(function (a, b) { return a.start - b.start; });
    for (var index = 1; index < errors.length; index += 1) {
      if (errors[index - 1].end > errors[index].start) throw new Error(t('selectionError'));
    }
    self.model = { schemaVersion: 2, source: source, html: clean, errors: errors };
    self.commit();
    self.renderDetails();
  };

  H5PEditor.FindAndCorrectErrors.prototype.selectTarget = function (id) {
    this.selectedId = id;
    this.visual.querySelectorAll('[data-fce-id]').forEach(function (marker) {
      marker.setAttribute('data-fce-selected', String(marker.getAttribute('data-fce-id') === id));
    });
    this.renderDetails();
  };

  H5PEditor.FindAndCorrectErrors.prototype.renderDetails = function () {
    var self = this;
    self.detailsBody.replaceChildren();
    var error = self.model.errors.find(function (item) { return item.id === self.selectedId; });
    if (!error) { self.detailsBody.textContent = t('empty'); return; }
    var accepted = textareaField(t('accepted'), (error.accepted || []).join('\n'));
    var hints = textareaField(t('hints'), (error.hints || []).join('\n'));
    var explanation = textareaField(t('feedback'), stripTags(error.explanation || ''));
    var attempts = inputField(t('attempts'), String(error.maxAttempts || 0), 'number');
    var identificationPoints = optionalNumberField(t('identificationPoints'), error.points && error.points.identification);
    var correctionPoints = optionalNumberField(t('correctionPoints'), error.points && error.points.correction);
    var incorrectPenalty = optionalNumberField(t('incorrectPenalty'), error.penalties && error.penalties.incorrectCorrection);
    var hintPenalty = optionalNumberField(t('hintPenalty'), error.penalties && error.penalties.hint);
    [accepted.input, hints.input, explanation.input, attempts.input, identificationPoints.input, correctionPoints.input, incorrectPenalty.input, hintPenalty.input].forEach(function (input) {
      input.addEventListener('input', function () {
        error.accepted = lines(accepted.input.value);
        error.hints = lines(hints.input.value);
        error.explanation = explanation.input.value ? '<p>' + escapeHtml(explanation.input.value) + '</p>' : '';
        error.maxAttempts = Math.max(0, parseInt(attempts.input.value, 10) || 0);
        error.points = error.points || {};
        error.penalties = error.penalties || {};
        setOptionalNumber(error.points, 'identification', identificationPoints.input.value);
        setOptionalNumber(error.points, 'correction', correctionPoints.input.value);
        setOptionalNumber(error.penalties, 'incorrectCorrection', incorrectPenalty.input.value);
        setOptionalNumber(error.penalties, 'hint', hintPenalty.input.value);
        self.commit();
      });
    });
    var actions = element('div', 'h5peditor-fce__details-actions');
    actions.append(
      button(t('move'), '', function () { self.moveSelected(); }),
      button(t('remove'), '', function () { self.removeSelected(); })
    );
    self.detailsBody.append(accepted.wrapper, hints.wrapper, explanation.wrapper, attempts.wrapper,
      identificationPoints.wrapper, correctionPoints.wrapper, incorrectPenalty.wrapper, hintPenalty.wrapper, actions);
  };

  H5PEditor.FindAndCorrectErrors.prototype.moveSelected = function () {
    var marker = this.visual.querySelector('[data-fce-id="' + cssEscape(this.selectedId) + '"]');
    if (!marker) return;
    this.pendingMoveId = this.selectedId;
    marker.replaceWith.apply(marker, Array.from(marker.childNodes));
    this.warn(t('mark'));
    this.visual.focus();
  };

  H5PEditor.FindAndCorrectErrors.prototype.removeSelected = function () {
    var id = this.selectedId;
    var marker = this.visual.querySelector('[data-fce-id="' + cssEscape(id) + '"]');
    if (marker) marker.replaceWith.apply(marker, Array.from(marker.childNodes));
    this.model.errors = this.model.errors.filter(function (item) { return item.id !== id; });
    this.selectedId = null;
    this.syncVisual();
  };

  H5PEditor.FindAndCorrectErrors.prototype.commit = function () {
    this.params = serialize(this.model);
    this.setValue(this.field, this.params);
  };

  H5PEditor.FindAndCorrectErrors.prototype.validate = function () {
    try {
      if (!this.markupPanel.hidden && !this.applyMarkup()) return false;
      this.syncVisual();
      if (!this.model.errors.length || this.model.errors.some(function (error) { return !error.accepted.length; })) {
        this.warn(t('required')); return false;
      }
      this.warn(''); return true;
    }
    catch (error) { this.warn(error.message); return false; }
  };

  H5PEditor.FindAndCorrectErrors.prototype.remove = function () {
    if (this.container) this.container.remove();
  };

  H5PEditor.FindAndCorrectErrors.prototype.warn = function (message) { this.warning.textContent = message || ''; };

  function parseValue(value) {
    if (String(value).startsWith(PREFIX)) {
      var parsed = JSON.parse(decodeEntities(String(value).slice(PREFIX.length)));
      parsed.html = sanitizeHtml(parsed.html || plainHtml(parsed.source, parsed.errors));
      return parsed;
    }
    var model = parseMarkup(String(value || ''));
    model.html = plainHtml(model.source, model.errors);
    return model;
  }

  function decodeEntities(value) {
    var textarea = document.createElement('textarea');
    textarea.innerHTML = value;
    return textarea.value;
  }

  function serialize(model) {
    return PREFIX + JSON.stringify({ schemaVersion: 2, source: model.source, html: sanitizeHtml(model.html), errors: model.errors.map(function (error) {
      return { id: error.id, start: error.start, end: error.end, source: error.source, accepted: error.accepted || [], hints: error.hints || [], explanation: sanitizeHtml(error.explanation || ''), maxAttempts: error.maxAttempts || 0, points: error.points || {}, penalties: error.penalties || {} };
    }) });
  }

  function parseMarkup(input) {
    var source = '', errors = [], index = 0;
    while (index < input.length) {
      if (input[index] === '\\') { if (!input[index + 1] || '\\[]|'.indexOf(input[index + 1]) < 0) throw new Error('Invalid escape at ' + (index + 1)); source += input[index + 1]; index += 2; continue; }
      if (input[index] !== '[') { source += input[index++]; continue; }
      var fields = [''], opening = index++, closed = false;
      while (index < input.length) {
        if (input[index] === '\\') { if (!input[index + 1]) throw new Error('Trailing escape'); fields[fields.length - 1] += input[index + 1]; index += 2; }
        else if (input[index] === ']') { closed = true; index++; break; }
        else if (input[index] === '|') { if (input[index + 1] === '|' && fields.length > 1) { fields.push(''); index += 2; } else if (fields.length === 1) { fields.push(''); index++; } else throw new Error('Invalid separator at ' + (index + 1)); }
        else if (input[index] === '[') throw new Error('Nested annotation at ' + (index + 1));
        else fields[fields.length - 1] += input[index++];
      }
      if (!closed || fields.length < 2 || !fields[0] || fields.slice(1).some(function (item) { return !item.trim(); })) throw new Error('Invalid annotation at ' + (opening + 1));
      var start = source.length; source += fields[0]; errors.push({ id: uniqueId(), start: start, end: source.length, source: fields[0], accepted: fields.slice(1), hints: [], explanation: '', maxAttempts: 0, points: {}, penalties: {} });
    }
    if (!errors.length) throw new Error('At least one error annotation is required.');
    return { schemaVersion: 2, source: source, errors: errors };
  }

  function compact(model) {
    var output = '', cursor = 0;
    model.errors.slice().sort(function (a, b) { return a.start - b.start; }).forEach(function (error) {
      output += escapeLiteral(model.source.slice(cursor, error.start));
      output += '[' + escapeField(error.source) + '|' + (error.accepted || []).map(escapeField).join('||') + ']';
      cursor = error.end;
    });
    return output + escapeLiteral(model.source.slice(cursor));
  }

  function plainHtml(source, errors) {
    var output = '', cursor = 0;
    errors.forEach(function (error) { output += escapeHtml(source.slice(cursor, error.start)); output += '<span data-fce-id="' + escapeHtml(error.id) + '">' + escapeHtml(error.source) + '</span>'; cursor = error.end; });
    return '<p>' + (output + escapeHtml(source.slice(cursor))).replace(/\r?\n/g, '</p><p>') + '</p>';
  }

  function sanitizeHtml(value) {
    return String(value || '').replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|iframe|object|embed|svg|math)[^>]*>[\s\S]*?<\/\1\s*>/gi, '').replace(/<\/?([a-z][a-z0-9-]*)([^>]*)>/gi, function (match, raw, attrs) {
      var name = raw.toLowerCase(); if (ALLOWED.indexOf(name) < 0) return ''; if (match.indexOf('</') === 0) return name === 'br' ? '' : '</' + name + '>'; if (name === 'br') return '<br>';
      if (name === 'span') { var found = attrs.match(/\bdata-fce-id\s*=\s*["']([^"']+)["']/i); return found && /^[A-Za-z0-9._:-]{1,80}$/.test(found[1]) ? '<span data-fce-id="' + escapeHtml(found[1]) + '">' : '<span>'; }
      return '<' + name + '>';
    });
  }

  function htmlText(html) { var holder = document.createElement('div'); holder.innerHTML = sanitizeHtml(html).replace(/<br\s*>/gi, '\n').replace(/<\/p\s*>\s*<p>/gi, '\n').replace(/^\s*<p>/i, '').replace(/<\/p>\s*$/i, ''); return holder.textContent; }
  function prefixText(root, marker, include) { var range = document.createRange(); range.selectNodeContents(root); include ? range.setEndAfter(marker) : range.setEndBefore(marker); var holder = document.createElement('div'); holder.appendChild(range.cloneContents()); return htmlText(holder.innerHTML); }
  function t(key) { try { return H5PEditor.t('H5PEditor.FindAndCorrectErrors', key) || FALLBACK[key]; } catch (error) { return FALLBACK[key]; } }
  function element(tag, className) { var node = document.createElement(tag); if (className) node.className = className; return node; }
  function button(label, className, handler) { var node = element('button', className); node.type = 'button'; node.textContent = label; node.addEventListener('click', handler); return node; }
  function textareaField(label, value) { return fieldControl(label, value, 'textarea'); }
  function inputField(label, value, type) { return fieldControl(label, value, 'input', type); }
  function optionalNumberField(label, value) { var field = inputField(label, Number.isFinite(Number(value)) ? String(value) : '', 'number'); field.input.min = '0'; field.input.step = '0.1'; return field; }
  function setOptionalNumber(target, key, value) { if (String(value).trim() === '') delete target[key]; else { var parsed = Number(value); if (Number.isFinite(parsed) && parsed >= 0) target[key] = parsed; } }
  function fieldControl(label, value, tag, type) { var wrapper = element('label'); wrapper.appendChild(document.createTextNode(label)); var input = element(tag); if (type) input.type = type; input.value = value; wrapper.appendChild(input); return { wrapper: wrapper, input: input }; }
  function lines(value) { return String(value).split(/\r?\n/).map(function (item) { return item.trim(); }).filter(Boolean); }
  function stripTags(value) { var holder = document.createElement('div'); holder.innerHTML = sanitizeHtml(value); return holder.textContent; }
  function escapeHtml(value) { return String(value).replace(/[&<>"']/g, function (character) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]; }); }
  function escapeLiteral(value) { return String(value).replace(/[\\[]/g, '\\$&'); }
  function escapeField(value) { return String(value).replace(/[\\\[\]|]/g, '\\$&'); }
  function uniqueId() { return 'error-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); }
  function cssEscape(value) { return window.CSS && CSS.escape ? CSS.escape(value) : String(value).replace(/[^A-Za-z0-9_-]/g, '\\$&'); }
})(H5P.jQuery);
