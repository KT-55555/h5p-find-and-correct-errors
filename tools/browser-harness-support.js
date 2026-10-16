(function () {
  'use strict';
  function jq(value) { return { 0: value, length: 1, get: function (index) { return index === 0 ? value : undefined; } }; }
  jq.extend = function (_deep, target) {
    Array.prototype.slice.call(arguments, 2).forEach(function (source) { merge(target, source); });
    return target;
  };
  function merge(target, source) {
    Object.keys(source || {}).forEach(function (key) {
      var value = source[key];
      if (value && typeof value === 'object' && !Array.isArray(value)) { target[key] = target[key] || {}; merge(target[key], value); }
      else target[key] = Array.isArray(value) ? JSON.parse(JSON.stringify(value)) : value;
    });
  }
  function Question() {
    this.wrapper = document.createElement('section');
    this.actions = document.createElement('div'); this.actions.className = 'h5p-question-buttons';
    this.wrapper.appendChild(this.actions); this.buttons = {};
  }
  Question.prototype.setContent = function ($content) { this.content = $content.get(0); this.wrapper.insertBefore(this.content, this.actions); };
  Question.prototype.addButton = function (id, label, callback, visible, attributes) { var node = document.createElement('button'); node.type = 'button'; node.textContent = label; node.hidden = !visible; Object.keys(attributes || {}).forEach(function (key) { node.setAttribute(key, attributes[key]); }); node.addEventListener('click', callback); this.buttons[id] = node; this.actions.appendChild(node); };
  Question.prototype.showButton = function (id) { this.buttons[id].hidden = false; };
  Question.prototype.hideButton = function (id) { this.buttons[id].hidden = true; };
  Question.prototype.setFeedback = function (_text, score, max) { document.getElementById('event-log').textContent = 'Score: ' + score + ' / ' + max; };
  Question.prototype.removeFeedback = function () { document.getElementById('event-log').textContent = ''; };
  Question.prototype.createXAPIEventTemplate = function (verb) { var statement = { verb: verb, object: { definition: {} }, result: {} }; return { data: { statement: statement }, setScoredResult: function (raw, max, _instance, completion, success) { statement.result.score = { min: 0, raw: raw, max: max, scaled: raw / max }; statement.result.completion = completion; statement.result.success = success; } }; };
  Question.prototype.trigger = function (event) { if (event && event.data) window.__lastXapi = event.data.statement; };
  window.H5P = { jQuery: jq, Question: Question };
})();
