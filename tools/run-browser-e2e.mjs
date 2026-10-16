import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, resolve, sep } from 'node:path';

const projectRoot = resolve(process.cwd());
const evidenceDir = join(projectRoot, 'evidence');
const dependencyRoot = process.env.FCE_TEST_DEPS_ROOT || projectRoot;
const results = [];
const browserErrors = [];
let chrome;
let profile;
let server;
let cdp;

function pass(criterion, evidence) {
  results.push({ criterion, result: 'PASS', evidence });
}

function chromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    join(process.env.PROGRAMFILES || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    join(process.env['PROGRAMFILES(X86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe')
  ].filter(Boolean);
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error('Google Chrome was not found. Set CHROME_PATH to its executable.');
  return found;
}

function freePort() {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      probe.close((error) => error ? reject(error) : resolvePort(address.port));
    });
  });
}

function staticServer() {
  const mime = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8'
  };
  return createServer(async (request, response) => {
    const requested = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname);
    if (requested === '/favicon.ico') {
      response.writeHead(204).end();
      return;
    }
    const filePath = resolve(projectRoot, `.${requested}`);
    if (!(filePath === projectRoot || filePath.startsWith(projectRoot + sep))) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    try {
      const info = await stat(filePath);
      if (!info.isFile()) throw new Error('Not a file');
      response.writeHead(200, {
        'Content-Type': mime[extname(filePath)] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      });
      createReadStream(filePath).pipe(response);
    }
    catch {
      response.writeHead(404).end('Not found');
    }
  });
}

async function pollJson(url, attempts = 80) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response.json();
    }
    catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

class CdpClient {
  constructor(url) {
    this.url = url;
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    this.socket = new WebSocket(this.url);
    await new Promise((resolveOpen, reject) => {
      this.socket.addEventListener('open', resolveOpen, { once: true });
      this.socket.addEventListener('error', reject, { once: true });
    });
    this.socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data));
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(message.error.message));
        else pending.resolve(message.result);
        return;
      }
      if (message.method === 'Runtime.exceptionThrown') {
        browserErrors.push(message.params.exceptionDetails.text || 'Runtime exception');
      }
      if (message.method === 'Log.entryAdded' && ['error', 'warning'].includes(message.params.entry.level)) {
        browserErrors.push(`${message.params.entry.level}: ${message.params.entry.text}`);
      }
    });
  }

  call(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolveCall, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, 15000);
      this.pending.set(id, {
        resolve: (value) => { clearTimeout(timeout); resolveCall(value); },
        reject: (error) => { clearTimeout(timeout); reject(error); }
      });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.socket?.close();
  }
}

async function evaluate(expression) {
  const response = await cdp.call('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true
  });
  if (response.exceptionDetails) {
    throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
  }
  return response.result.value;
}

async function waitFor(expression, message, attempts = 80) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await evaluate(expression)) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 50));
  }
  throw new Error(message);
}

async function navigate(url) {
  await cdp.call('Page.navigate', { url });
  await waitFor('document.readyState === "complete"', `Page did not load: ${url}`);
}

async function clickByExpression(elementExpression) {
  const point = await evaluate(`(() => {
    const element = ${elementExpression};
    if (!element) return null;
    const rect = element.getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  assert.ok(point, `Element not found: ${elementExpression}`);
  await cdp.call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: point.x, y: point.y });
  await cdp.call('Input.dispatchMouseEvent', { type: 'mousePressed', x: point.x, y: point.y, button: 'left', clickCount: 1 });
  await cdp.call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: point.x, y: point.y, button: 'left', clickCount: 1 });
}

async function clickToken(text) {
  await clickByExpression(`[...document.querySelectorAll('.fce-token')].find((node) => node.textContent === ${JSON.stringify(text)})`);
}

async function replaceFocusedText(text) {
  await cdp.call('Input.dispatchKeyEvent', {
    type: 'keyDown', key: 'a', code: 'KeyA', modifiers: 2, windowsVirtualKeyCode: 65
  });
  await cdp.call('Input.dispatchKeyEvent', {
    type: 'keyUp', key: 'a', code: 'KeyA', modifiers: 2, windowsVirtualKeyCode: 65
  });
  await cdp.call('Input.insertText', { text });
  await pressEnter();
}

async function pressEnter() {
  await cdp.call('Input.dispatchKeyEvent', {
    type: 'rawKeyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13
  });
  await cdp.call('Input.dispatchKeyEvent', {
    type: 'char', key: 'Enter', code: 'Enter', text: '\r', unmodifiedText: '\r', windowsVirtualKeyCode: 13
  });
  await cdp.call('Input.dispatchKeyEvent', {
    type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13
  });
}

async function pressTab(reverse = false) {
  const modifiers = reverse ? 8 : 0;
  await cdp.call('Input.dispatchKeyEvent', {
    type: 'rawKeyDown', key: 'Tab', code: 'Tab', modifiers, windowsVirtualKeyCode: 9
  });
  await cdp.call('Input.dispatchKeyEvent', {
    type: 'keyUp', key: 'Tab', code: 'Tab', modifiers, windowsVirtualKeyCode: 9
  });
}

async function pressSpace() {
  await cdp.call('Input.dispatchKeyEvent', {
    type: 'rawKeyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32
  });
  await cdp.call('Input.dispatchKeyEvent', {
    type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32
  });
}

async function screenshot(name) {
  const capture = await cdp.call('Page.captureScreenshot', { format: 'png', fromSurface: true });
  await writeFile(join(evidenceDir, name), Buffer.from(capture.data, 'base64'));
}

async function runAxe(label) {
  if (!await evaluate('typeof axe !== "undefined"')) {
    const source = await readFile(join(dependencyRoot, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');
    await evaluate(`${source}\ntrue`);
  }
  const violations = await evaluate(`axe.run(document).then((result) =>
    result.violations.map((item) => ({ id: item.id, impact: item.impact, nodes: item.nodes.length })))`);
  const serious = violations.filter((item) => ['serious', 'critical'].includes(item.impact));
  assert.deepEqual(serious, [], `${label} has serious/critical axe violations`);
  const violationSummary = violations.length
    ? violations.map((item) => `${item.id} (${item.impact}, ${item.nodes} node${item.nodes === 1 ? '' : 's'})`).join('; ')
    : 'no violations';
  pass(`${label} axe-core scan`, `${violationSummary}; 0 serious/critical`);
  return violations;
}

async function runRuntime(baseUrl) {
  await navigate(`${baseUrl}/test/browser-harness.html`);
  const initial = await evaluate(`({
    tokenCount: document.querySelectorAll('.fce-token').length,
    remaining: document.querySelector('.fce-remaining').textContent,
    score: window.__fce.getScore(),
    max: window.__fce.getMaxScore(),
    tokenClasses: [...document.querySelectorAll('.fce-token')].map((node) => node.className)
  })`);
  assert.equal(initial.remaining, 'Errors remaining: 2');
  assert.equal(initial.score, 0);
  assert.equal(initial.max, 4);
  assert.equal(new Set(initial.tokenClasses).size, 1);
  pass('Real Chromium initial learner render', `${initial.tokenCount} neutral word buttons; score 0/4`);

  await clickToken('The');
  await waitFor("document.querySelector('.fce-status').textContent === 'No error here.'", 'Wrong-click feedback was not announced');
  await clickToken('The');
  const wrongState = await evaluate(`({ score: __fce.getScore(), wrong: Object.keys(__fce.state.ledger).filter((key) => key.startsWith('wrong:')).length })`);
  assert.deepEqual(wrongState, { score: 0, wrong: 1 });
  pass('Pointer wrong-click deduplication', 'Repeated activation produced one ledger penalty and score floor 0');

  await clickToken('were');
  await waitFor("document.activeElement?.classList.contains('fce-correction')", 'First correction field did not receive focus');
  const firstInput = await evaluate(`({ value: document.activeElement.value, label: document.activeElement.getAttribute('aria-label') })`);
  assert.deepEqual(firstInput, { value: 'were', label: 'Correction for error 1 of 2' });
  await replaceFocusedText('was');
  await waitFor("document.querySelector('.fce-corrected')?.textContent === 'was'", 'First correction was not accepted');

  await clickToken('have');
  await waitFor("document.activeElement?.classList.contains('fce-correction')", 'Multiword correction field did not receive focus');
  const phraseInput = await evaluate('document.activeElement.value');
  assert.equal(phraseInput, 'have completed');
  await replaceFocusedText('has completed');
  await waitFor("document.querySelectorAll('.fce-corrected').length === 2", 'Second correction was not accepted');
  const corrected = await evaluate(`({
    text: [...document.querySelectorAll('.fce-corrected')].map((node) => node.textContent),
    remaining: document.querySelector('.fce-remaining').textContent,
    score: __fce.getScore()
  })`);
  assert.deepEqual(corrected, { text: ['was', 'has completed'], remaining: 'Errors remaining: 0', score: 3.5 });
  pass('Pointer correction and multiword target', 'Both targets corrected; full phrase was prefilled; penalty-adjusted score 3.5/4');

  await evaluate(`document.querySelector('button[aria-label="Finish"]').focus(); true`);
  await pressEnter();
  await waitFor('__fce.state.completed === true', 'Finish did not complete the activity');
  const completion = await evaluate(`({
    feedback: document.getElementById('event-log').textContent,
    answered: __fce.answered,
    state: __fce.getCurrentState(),
    xapi: window.__lastXapi
  })`);
  assert.equal(completion.feedback, 'Score: 3.5 / 4');
  assert.equal(completion.answered, true);
  assert.equal(completion.xapi.verb, 'completed');
  assert.equal(completion.xapi.result.response, 'was[,]has completed');
  assert.equal(completion.xapi.result.completion, true);
  pass('Question state and xAPI in Chromium', 'Completed event response and score 3.5/4 verified');

  const restored = await evaluate(`(() => {
    const mount = document.querySelector('main').appendChild(document.createElement('div'));
    const copy = new H5P.FindAndCorrectErrors(__fce.params, 2, { previousState: __fce.getCurrentState() });
    mount.appendChild(copy.wrapper);
    return { score: copy.getScore(), answered: copy.answered, corrected: mount.querySelectorAll('.fce-corrected').length };
  })()`);
  assert.deepEqual(restored, { score: 3.5, answered: true, corrected: 2 });
  pass('Browser state restoration API', 'Restored score, answered state and both corrected targets');

  await evaluate('__fce.resetTask(); true');
  await evaluate(`[...document.querySelectorAll('.fce-token')].find((node) => node.textContent === 'were').focus(); true`);
  await pressEnter();
  await waitFor("document.activeElement?.classList.contains('fce-correction')", 'Keyboard activation did not open and focus a correction field');
  pass('Keyboard-only target activation', 'Enter opened the target and moved focus to its correction field');

  await evaluate('__fce.resetTask(); document.querySelector(".fce-token").focus(); true');
  const firstTabStop = await evaluate('document.activeElement.textContent');
  await pressTab();
  const secondTabStop = await evaluate('document.activeElement.textContent');
  await pressTab(true);
  assert.equal(await evaluate('document.activeElement.textContent'), firstTabStop);
  assert.notEqual(secondTabStop, firstTabStop);
  pass('Keyboard Tab and Shift+Tab order', 'Focus advanced to the next token and returned to the original token without a trap');

  await evaluate(`__fce.resetTask(); [...document.querySelectorAll('.fce-token')].find((node) => node.textContent === 'were').focus(); true`);
  await pressSpace();
  await waitFor("document.activeElement?.classList.contains('fce-correction')", 'Space did not open and focus a correction field');
  pass('Keyboard Space activation', 'Space opened the target and transferred focus to the labeled correction field');

  await screenshot('m5-runtime-desktop.png');
  await runAxe('Learner surface');

  await cdp.call('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
    screenOrientation: { type: 'portraitPrimary', angle: 0 }
  });
  const mobile = await evaluate(`({
    innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    inputWidth: document.querySelector('.fce-correction')?.getBoundingClientRect().width || 0,
    smallestTarget: Math.min(...[...document.querySelectorAll('.fce-token')].map((node) => Math.min(node.getBoundingClientRect().width, node.getBoundingClientRect().height)))
  })`);
  assert.ok(mobile.scrollWidth <= mobile.innerWidth, `Horizontal overflow: ${mobile.scrollWidth} > ${mobile.innerWidth}`);
  assert.ok(mobile.inputWidth > 0 && mobile.inputWidth <= mobile.innerWidth);
  assert.ok(mobile.smallestTarget >= 24, `Smallest learner target is ${mobile.smallestTarget}px`);
  pass('Mobile Chromium reflow and target size', `390x844 viewport; no horizontal overflow; smallest token target ${mobile.smallestTarget}px`);
  await screenshot('m5-runtime-mobile.png');
  await cdp.call('Emulation.clearDeviceMetricsOverride');

  await cdp.call('Emulation.setEmulatedMedia', { features: [
    { name: 'forced-colors', value: 'active' },
    { name: 'prefers-reduced-motion', value: 'reduce' }
  ] });
  const media = await evaluate(`({
    forcedColors: matchMedia('(forced-colors: active)').matches,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    scrollBehavior: getComputedStyle(document.querySelector('.h5p-find-and-correct-errors')).scrollBehavior
  })`);
  assert.deepEqual(media, { forcedColors: true, reducedMotion: true, scrollBehavior: 'auto' });
  pass('Forced-colours and reduced-motion CSS', 'Chromium emulation activated both media features; project reduced-motion rule computed to auto scrolling');
  await cdp.call('Emulation.setEmulatedMedia', { features: [] });
}

async function runEditor(baseUrl) {
  await navigate(`${baseUrl}/test/editor-browser-harness.html`);
  const initial = await evaluate(`({
    markers: document.querySelectorAll('#mount [data-fce-id]').length,
    text: document.querySelector('#mount .h5peditor-fce__visual').textContent,
    savedPrefix: window.__saved.slice(0, 5)
  })`);
  assert.equal(initial.markers, 2);
  assert.equal(initial.savedPrefix, 'FCE2\n');
  pass('Real Chromium editor render', `Two target annotations rendered and saved as ${initial.savedPrefix.trim()}`);

  await clickByExpression(`document.querySelector('#mount .h5peditor-fce__tab:nth-child(2)')`);
  const markup = await evaluate(`({
    hidden: document.querySelector('#mount .h5peditor-fce__markup-panel').hidden,
    value: document.querySelector('#mount .h5peditor-fce__markup').value
  })`);
  assert.equal(markup.hidden, false);
  assert.match(markup.value, /\[were\|was\]/);
  assert.match(markup.value, /\[have completed\|has completed\|\|has finished\]/);
  await clickByExpression(`document.querySelector('#mount .h5peditor-fce__tab:nth-child(1)')`);
  assert.equal(await evaluate('window.__editor.validate()'), true);
  const reopened = await evaluate(`(() => {
    const original = window.__saved;
    const editor = window.__reopen();
    return {
      stable: original === window.__reopenedSaved,
      markers: document.querySelectorAll('#reopen [data-fce-id]').length,
      text: document.querySelector('#reopen .h5peditor-fce__visual').textContent,
      valid: editor.validate()
    };
  })()`);
  assert.deepEqual(reopened, {
    stable: true,
    markers: 2,
    text: 'The research team were ready. It have completed the review.',
    valid: true
  });
  pass('Editor mode round-trip and save/reopen', 'FCE2 remained byte-stable with two targets and multiple answers');
  await screenshot('m5-editor-desktop.png');
  await runAxe('Editor surface');
}

try {
  await mkdir(evidenceDir, { recursive: true });
  const webPort = await freePort();
  const debugPort = await freePort();
  server = staticServer();
  await new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(webPort, '127.0.0.1', resolveListen);
  });

  profile = await mkdtemp(join(tmpdir(), 'fce-browser-e2e-'));
  chrome = spawn(chromePath(), [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profile}`,
    '--window-size=1280,900',
    'about:blank'
  ], { stdio: 'ignore' });

  const versionEndpoint = `http://127.0.0.1:${debugPort}`;
  const version = await pollJson(`${versionEndpoint}/json/version`);
  const targets = await pollJson(`${versionEndpoint}/json/list`);
  const page = targets.find((target) => target.type === 'page');
  assert.ok(page?.webSocketDebuggerUrl, 'Chrome did not expose a page target');
  cdp = new CdpClient(page.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.call('Page.enable');
  await cdp.call('Runtime.enable');
  await cdp.call('Log.enable');

  const baseUrl = `http://127.0.0.1:${webPort}`;
  await runRuntime(baseUrl);
  await runEditor(baseUrl);
  assert.deepEqual(browserErrors, [], `Browser console/runtime errors: ${browserErrors.join('; ')}`);
  pass('Browser console/runtime', 'No warnings, errors or uncaught exceptions');

  const report = {
    environment: {
      browser: version.Browser,
      protocolVersion: version['Protocol-Version'],
      viewportDesktop: '1280x900',
      viewportMobile: '390x844'
    },
    summary: { passed: results.length, failed: 0 },
    results
  };
  await writeFile(join(evidenceDir, 'm5-browser-e2e-results.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Browser E2E: ${results.length} passed, 0 failed (${version.Browser}).`);
}
catch (error) {
  const report = {
    summary: { passed: results.length, failed: 1 },
    results,
    failure: error.message,
    browserErrors
  };
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(join(evidenceDir, 'm5-browser-e2e-results.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
finally {
  cdp?.close();
  if (chrome && chrome.exitCode === null) {
    const exited = new Promise((resolveExit) => chrome.once('exit', resolveExit));
    chrome.kill();
    await Promise.race([exited, new Promise((resolveWait) => setTimeout(resolveWait, 2000))]);
  }
  if (server) await new Promise((resolveClose) => server.close(resolveClose));
  if (profile) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        await rm(profile, { recursive: true, force: true });
        break;
      }
      catch (error) {
        if (error.code !== 'EBUSY' || attempt === 9) throw error;
        await new Promise((resolveWait) => setTimeout(resolveWait, 100));
      }
    }
  }
}
