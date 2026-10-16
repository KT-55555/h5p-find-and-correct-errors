import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const projectRoot = resolve(process.cwd());
const evidenceDir = join(projectRoot, 'evidence');
const dependencyRoot = process.env.FCE_TEST_DEPS_ROOT || projectRoot;
const baseUrl = process.env.FCE_HOST_URL || 'http://127.0.0.1:8787';
const contentId = Number(process.env.FCE_HOST_CONTENT_ID || 2);
const hostInfoPath = join(process.env.LOCALAPPDATA || '', 'CodexLocalHosts', 'H5P-FindAndCorrectErrors', 'config', 'host-info.txt');
const results = [];
const browserErrors = [];
let chrome;
let profile;
let cdp;

function pass(criterion, evidence) { results.push({ criterion, result: 'PASS', evidence }); }

function chromePath() {
  const candidates = [
    process.env.CHROME_PATH,
    join(process.env.PROGRAMFILES || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    join(process.env['PROGRAMFILES(X86)'] || '', 'Google', 'Chrome', 'Application', 'chrome.exe'),
    join(process.env.LOCALAPPDATA || '', 'Google', 'Chrome', 'Application', 'chrome.exe')
  ].filter(Boolean);
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) throw new Error('Google Chrome was not found.');
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

async function pollJson(url, attempts = 100) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try { const response = await fetch(url); if (response.ok) return response.json(); }
    catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

class CdpClient {
  constructor(url) { this.url = url; this.nextId = 1; this.pending = new Map(); }
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
        message.error ? pending.reject(new Error(message.error.message)) : pending.resolve(message.result);
      }
      else if (message.method === 'Runtime.exceptionThrown') browserErrors.push(message.params.exceptionDetails.text || 'Runtime exception');
      else if (message.method === 'Log.entryAdded' && ['error', 'warning'].includes(message.params.entry.level)) browserErrors.push(`${message.params.entry.level}: ${message.params.entry.text}`);
    });
  }
  call(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolveCall, reject) => {
      const timeout = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 20000);
      this.pending.set(id, {
        resolve: (value) => { clearTimeout(timeout); resolveCall(value); },
        reject: (error) => { clearTimeout(timeout); reject(error); }
      });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  close() { this.socket?.close(); }
}

async function evaluate(expression) {
  const response = await cdp.call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
  return response.result.value;
}

async function waitFor(expression, message, attempts = 120) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await evaluate(expression)) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error(message);
}

async function navigate(url) {
  await cdp.call('Page.navigate', { url });
  await waitFor('document.readyState === "complete"', `Page did not load: ${url}`);
}

async function screenshot(name) {
  const capture = await cdp.call('Page.captureScreenshot', { format: 'png', fromSurface: true, captureBeyondViewport: false });
  await writeFile(join(evidenceDir, name), Buffer.from(capture.data, 'base64'));
}

function credential(text, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const value = text.match(new RegExp(`^${escaped}\\s*[:=]\\s*(.+)$`, 'mi'))?.[1]?.trim();
  if (!value) throw new Error(`Local host credential field is missing: ${label}`);
  return value;
}

async function login() {
  const info = await readFile(hostInfoPath, 'utf8');
  const username = credential(info, 'Admin user');
  const password = credential(info, 'Admin password');
  await navigate(`${baseUrl}/wp-login.php`);
  const expression = `(() => {
    const user = document.querySelector('#user_login');
    const pass = document.querySelector('#user_pass');
    user.value = ${JSON.stringify(username)};
    pass.value = ${JSON.stringify(password)};
    user.dispatchEvent(new Event('input', { bubbles: true }));
    pass.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector('#loginform').submit();
    return true;
  })()`;
  await evaluate(expression);
  await waitFor(`location.href.startsWith(${JSON.stringify(baseUrl + '/wp-admin/')})`, 'Local WordPress login failed.');
  pass('Localhost authentication', 'Authenticated to the loopback-only WordPress host; credentials were read machine-locally and never logged.');
}

async function injectAxe(windowExpression) {
  const source = await readFile(join(dependencyRoot, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');
  await evaluate(`(() => { const target = ${windowExpression}; if (!target.axe) target.eval(${JSON.stringify(source)}); return true; })()`);
}

async function axeScope(windowExpression, selector, label) {
  await injectAxe(windowExpression);
  const violations = await evaluate(`(() => { const target = ${windowExpression}; return target.axe.run(target.document.querySelector(${JSON.stringify(selector)}), { rules: { region: { enabled: false } } }).then(result => result.violations.map(item => ({ id: item.id, impact: item.impact, nodes: item.nodes.length }))); })()`);
  const serious = violations.filter((item) => ['serious', 'critical'].includes(item.impact));
  assert.deepEqual(serious, [], `${label} has serious/critical axe findings`);
  pass(`${label} hosted axe scan`, `${violations.length} total findings; 0 serious/critical`);
  return violations;
}

async function runLearner() {
  const url = `${baseUrl}/wp-admin/admin.php?page=h5p&task=show&id=${contentId}`;
  await navigate(url);
  const frame = `document.querySelector('iframe.h5p-iframe').contentWindow`;
  await waitFor(`Boolean(${frame}?.H5P?.instances?.[0] && ${frame}.document.querySelector('.h5p-find-and-correct-errors'))`, 'Hosted learner did not initialize.');
  const payload = await evaluate(`(() => {
    const instance = ${frame}.H5P.instances[0];
    const statement = instance.getXAPIData().statement;
    const state = instance.getCurrentState();
    return {
      title: document.querySelector('h1, h2')?.textContent?.trim() || document.title,
      tokenCount: ${frame}.document.querySelectorAll('.fce-token').length,
      score: statement.result.score,
      completion: statement.result.completion,
      success: statement.result.success,
      responseCount: String(statement.result.response || '').split('[,]').length,
      interactionType: statement.object.definition.interactionType,
      correctResponsesPattern: statement.object.definition.correctResponsesPattern,
      stateVersion: state.version,
      retries: state.retries,
      answered: state.answered,
      completed: state.completed,
      retryVisible: Array.from(${frame}.document.querySelectorAll('button')).some(button => button.textContent.trim() === 'Retry' && !button.hidden)
    };
  })()`);
  assert.equal(payload.stateVersion, 3);
  assert.equal(payload.completed, true);
  assert.equal(payload.retries, 1);
  assert.equal(payload.retryVisible, false);
  assert.equal(payload.interactionType, 'fill-in');
  assert.equal(payload.responseCount, 2);
  assert.equal(payload.score.max, 5.5);
  pass('Actual-host state and xAPI payload', `State v3 restored completed with retry count 1; fill-in score max ${payload.score.max}; two responses; Retry hidden at limit.`);
  const learnerViolations = await axeScope(frame, '.h5p-find-and-correct-errors', 'Learner');
  await screenshot('m5-host-learner-desktop.png');

  const layouts = [];
  for (const layout of [
    { width: 390, height: 844, scale: 1, name: 'mobile' },
    { width: 320, height: 800, scale: 2, name: 'narrow-200pct' },
    { width: 320, height: 800, scale: 4, name: 'narrow-400pct' }
  ]) {
    await cdp.call('Emulation.setDeviceMetricsOverride', { width: layout.width, height: layout.height, deviceScaleFactor: 1, mobile: true });
    await cdp.call('Emulation.setPageScaleFactor', { pageScaleFactor: layout.scale });
    await evaluate(`window.dispatchEvent(new Event('resize')); ${frame}.dispatchEvent(new Event('resize')); true`);
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
    const dimensions = await evaluate(`(() => { const w=${frame}; return { outerInner: innerWidth, outerScroll: document.documentElement.scrollWidth, innerInner: w.innerWidth, innerScroll: w.document.documentElement.scrollWidth }; })()`);
    assert.ok(dimensions.outerScroll <= dimensions.outerInner, `${layout.name} outer overflow`);
    assert.ok(dimensions.innerScroll <= dimensions.innerInner, `${layout.name} H5P overflow`);
    layouts.push({ ...layout, ...dimensions });
    await screenshot(`m5-host-learner-${layout.name}.png`);
  }
  pass('Actual-host reflow', 'No outer or H5P horizontal overflow at 390x844 and at 320px with 200% and 400% page scale.');
  await cdp.call('Emulation.setPageScaleFactor', { pageScaleFactor: 1 });
  await cdp.call('Emulation.clearDeviceMetricsOverride');
  return { payload, learnerViolations, layouts };
}

async function runEditor() {
  await navigate(`${baseUrl}/wp-admin/admin.php?page=h5p_new&id=${contentId}`);
  const frame = `document.querySelector('iframe.h5p-editor-iframe').contentWindow`;
  await waitFor(`Boolean(${frame}?.document?.querySelector('.h5peditor-fce'))`, 'Hosted editor did not initialize.');
  const editor = await evaluate(`(() => { const doc=${frame}.document; return { markers: doc.querySelectorAll('[data-fce-id]').length, tabs: doc.querySelectorAll('[role=tab]').length, scoringFields: Array.from(doc.querySelectorAll('.h5peditor-fce input[type=number]')).length, title: doc.querySelector('#field-extratitle--1')?.value || '' }; })()`);
  assert.equal(editor.markers, 2);
  assert.equal(editor.tabs, 2);
  assert.match(editor.title, /UPDATED/);
  const editorViolations = await axeScope(frame, '.h5peditor-fce', 'Editor widget');
  await screenshot('m5-host-editor-desktop.png');
  pass('Actual native editor reopen', 'Two targets and both authoring modes reopened after save/update; updated title persisted.');
  return { editor, editorViolations };
}

try {
  await mkdir(evidenceDir, { recursive: true });
  const debugPort = await freePort();
  profile = await mkdtemp(join(tmpdir(), 'fce-host-e2e-'));
  chrome = spawn(chromePath(), [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, '--window-size=1280,900', 'about:blank'
  ], { stdio: 'ignore' });
  const endpoint = `http://127.0.0.1:${debugPort}`;
  const version = await pollJson(`${endpoint}/json/version`);
  const targets = await pollJson(`${endpoint}/json/list`);
  const page = targets.find((target) => target.type === 'page');
  cdp = new CdpClient(page.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.call('Page.enable'); await cdp.call('Runtime.enable'); await cdp.call('Log.enable');
  await login();
  const learner = await runLearner();
  const editor = await runEditor();
  const knownHostWarnings = browserErrors.filter((message) => message.includes("Allow attribute will take precedence over 'allowfullscreen'"));
  const unexpectedBrowserErrors = browserErrors.filter((message) => !knownHostWarnings.includes(message));
  assert.deepEqual(unexpectedBrowserErrors, [], `Unexpected browser console/runtime findings: ${unexpectedBrowserErrors.join('; ')}`);
  pass('Actual-host browser console', `No uncaught exceptions or project warnings; ${knownHostWarnings.length} known Chromium/H5P iframe allowfullscreen warning recorded.`);
  const report = { environment: { browser: version.Browser, host: baseUrl, contentId }, summary: { passed: results.length, failed: 0 }, results, learner, editor, browserErrors };
  await writeFile(join(evidenceDir, 'm5-host-e2e-results.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Host E2E: ${results.length} passed, 0 failed (${version.Browser}).`);
}
catch (error) {
  const report = { environment: { host: baseUrl, contentId }, summary: { passed: results.length, failed: 1 }, results, failure: error.message, browserErrors };
  await mkdir(evidenceDir, { recursive: true });
  await writeFile(join(evidenceDir, 'm5-host-e2e-results.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
finally {
  cdp?.close();
  if (chrome && chrome.exitCode === null) chrome.kill();
  if (profile) {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try { await rm(profile, { recursive: true, force: true }); break; }
      catch (error) { if (error.code !== 'EBUSY' || attempt === 9) throw error; await new Promise((resolveWait) => setTimeout(resolveWait, 100)); }
    }
  }
}
