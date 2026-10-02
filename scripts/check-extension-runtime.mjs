import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = path.resolve(root, process.argv[3] || 'artifacts/launch-20260907/runtime-check-0.7.1');
await mkdir(out, { recursive: true });
const store = path.resolve(root, process.argv[2] || 'artifacts/launch-20260907/store');
const packageReport = JSON.parse(await readFile(path.join(store, 'package-report.json'), 'utf8'));
const zip = await readFile(path.join(store, packageReport.package));
assert.equal(createHash('sha256').update(zip).digest('hex'), packageReport.sha256);
const run = await mkdtemp(path.join(out, 'run-'));
const unpacked = path.join(run, 'unpacked');
await mkdir(unpacked);
let offset = 0, fileCount = 0;
while (zip.readUInt32LE(offset) === 0x04034b50) {
  const method = zip.readUInt16LE(offset + 8), length = zip.readUInt32LE(offset + 18);
  const nameLength = zip.readUInt16LE(offset + 26), extraLength = zip.readUInt16LE(offset + 28);
  const name = zip.subarray(offset + 30, offset + 30 + nameLength).toString();
  assert.ok(!name.includes('..') && !path.isAbsolute(name), 'Only safe package paths may be extracted');
  const start = offset + 30 + nameLength + extraLength;
  const compressed = zip.subarray(start, start + length);
  const data = method === 8 ? inflateRawSync(compressed) : compressed;
  const expected = packageReport.files.find(file => file.path === name);
  assert.equal(createHash('sha256').update(data).digest('hex'), expected?.sha256, `Package hash mismatch: ${name}`);
  const target = path.join(unpacked, name);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, data);
  offset = start + length;
  fileCount++;
}
assert.equal(fileCount, packageReport.files.length);
const require = createRequire(import.meta.url);
const modules = process.env.PLAYWRIGHT_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(path.join(modules, 'playwright'));
const browserCandidates = [process.env.REACHARD_TEST_CHROMIUM, ...['1237', '1217'].map(version => path.join(process.env.LOCALAPPDATA, `ms-playwright/chromium-${version}/chrome-win64/chrome.exe`))].filter(Boolean);
const executablePath = browserCandidates.find(value => existsSync(value));
const report = {
  checkedAt: new Date().toISOString(), package: packageReport.package, packageSha256: packageReport.sha256,
  kind: 'Unpacked installation from final ZIP in an isolated Chromium profile; not a Chrome Web Store installation.',
  executablePath: executablePath || null, runDirectory: run, checks: {}, errors: [], network: [], screenshots: [],
  limitations: ['No Chrome Web Store identity, review or publication.', 'No signed-in account, token recovery, payment, live provider, or email delivery verification.', 'Local page data is fictional; Chrome extension APIs are real and are not mocked.']
};
// Some headless Chromium builds cannot capture a surface while its native panel
// is open. Preserve that limitation without skipping the behavior assertions.
async function captureScreenshot(name, capture) {
  try {
    await capture();
    report.screenshots.push(name);
  } catch (error) {
    (report.screenshotWarnings ||= []).push({ name, error: error.message });
  }
}
if (!executablePath) {
  report.blocked = 'No supported installed Chromium/Chrome for Testing found. No browser installed.';
  await writeFile(path.join(out, 'runtime-report.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(report.blocked);
  process.exit(0);
}
const fixture = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Software Engineer at Northstar Robotics</title><meta property="og:site_name" content="Northstar Robotics"><script type="application/ld+json">{"@context":"https://schema.org","@type":"JobPosting","title":"Software Engineer, Robotics Data Systems","hiringOrganization":{"@type":"Organization","name":"Northstar Robotics"},"jobLocation":{"address":{"addressLocality":"San Francisco","addressRegion":"CA"}},"description":"Build distributed data systems for robotics research."}</script><style>body{margin:0;background:#fafafa;color:#202429;font-family:Arial,sans-serif}main{padding:72px 80px;max-width:840px}small{display:inline-block;padding:9px 14px;border-radius:20px;background:#eaf3ff;color:#0062d1}h1{font-size:46px;letter-spacing:-1.6px;font-weight:500;line-height:1.1;margin:42px 0 26px}p{color:#66717d;font-size:17px;line-height:1.7}.foot{font-size:14px;position:fixed;bottom:36px;left:80px}</style></head><body><main><small>Sample job · Real unpacked extension runtime</small><h1>Software Engineer,<br>Robotics Data Systems</h1><p>Northstar Robotics · San Francisco, CA</p><p>Build reliable data systems for robotics research.<br>This fictional local job page tests page recognition and the extension launcher.</p><p>The extension is signed out. No token, paid search, or email sending is involved.</p><p class="foot">Chrome APIs and content-script injection are real. This is not a Chrome Web Store installation.</p></main></body></html>`;
const server = http.createServer((req, res) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(fixture); });
await new Promise(resolve => server.listen(3028, '127.0.0.2', resolve));
let context;
try {
  context = await chromium.launchPersistentContext(path.join(run, 'profile'), {
    executablePath, headless: true, viewport: { width: 1280, height: 800 },
    args: [`--disable-extensions-except=${unpacked}`, `--load-extension=${unpacked}`, '--enable-unsafe-extension-debugging', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.2, EXCLUDE 127.0.0.1, EXCLUDE localhost']
  });
  await context.route('**/*', route => {
    const url = route.request().url();
    const allowed = url.startsWith('http://127.0.0.2:3028/') || url.startsWith('chrome-extension:') || url.startsWith('data:');
    report.network.push({ url, action: allowed ? 'allow' : 'block' });
    return allowed ? route.continue() : route.abort();
  });
  context.on('page', page => page.on('pageerror', error => report.errors.push({ target: page.url(), error: error.message })));
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker', { timeout: 12000 });
  report.workerUrl = worker.url();
  report.extensionId = worker.url().split('/')[2];
  report.browserVersion = await worker.evaluate(() => navigator.userAgent);
  report.checks.workerStarted = true;
  const runtimeState = await worker.evaluate(async () => {
    const manifest = chrome.runtime.getManifest();
    const local = await chrome.storage.local.get(['extensionApiToken', 'accountStatus']);
    const sync = await chrome.storage.sync.get(['extensionApiToken', 'accountStatus']);
    return { name: manifest.name, version: manifest.version, permissions: manifest.permissions, hasLocalToken: !!local.extensionApiToken, hasSyncToken: !!sync.extensionApiToken, accountCached: !!local.accountStatus, sidePanel: await chrome.sidePanel.getOptions({}) };
  });
  assert.equal(runtimeState.version, packageReport.version);
  assert.equal(runtimeState.hasLocalToken, false);
  assert.equal(runtimeState.hasSyncToken, false);
  report.runtimeState = runtimeState;
  report.permissionEvidence = await worker.evaluate(async () => {
    const manifest = chrome.runtime.getManifest();
    const warnings = await chrome.management.getPermissionWarningsByManifest(JSON.stringify(manifest));
    const self = await chrome.management.getSelf();
    return { warnings, granted: await chrome.permissions.getAll(), installType: self.installType, hostPermissions: self.hostPermissions, apiPermissions: self.permissions };
  });
  report.checks.freshProfileSignedOut = true;
  assert.ok(!report.permissionEvidence.warnings.some(warning => /all (?:the )?(?:web ?sites|sites)|所有网站/i.test(warning)), 'No all-websites permission warning');
  report.checks.noAllWebsitesPermissionWarning = true;
  const job = await context.newPage();
  await job.goto('http://127.0.0.2:3028/jobs/robotics', { waitUntil: 'domcontentloaded' });
  const launcher = job.getByRole('button', { name: 'Find with Reachard' });
  assert.equal(await launcher.count(), 0, 'Unlisted sites must not receive the automatic launcher');
  await job.bringToFront();
  const jobTab = await worker.evaluate(async () => (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]);
  const canInject = tabId => worker.evaluate(async id => {
    try { await chrome.scripting.executeScript({ target: { tabId: id }, func: () => document.title }); return true; }
    catch { return false; }
  }, tabId);
  assert.equal(await canInject(jobTab.id), false, 'A new unlisted site must not be readable before activation');
  report.checks.unlistedSiteNotReadBeforeClick = true;
  const debug = await context.newCDPSession(job);
  const browserDebug = await context.browser().newBrowserCDPSession();
  const actionTargets = await browserDebug.send('Target.getTargets', { filter: [{ type: 'tab' }] });
  const actionTarget = actionTargets.targetInfos.find(target => target.url === job.url());
  assert.ok(actionTarget, 'Find the actual browser tab target for the toolbar action');
  await browserDebug.send('Extensions.triggerAction', { id: report.extensionId, targetId: actionTarget.targetId });
  await launcher.waitFor({ timeout: 10000 });
  assert.equal(await canInject(jobTab.id), true, 'The toolbar action must grant real activeTab access');
  report.checks.toolbarGrantsTemporaryPageAccess = true;
  const pageContext = await worker.evaluate(tabId => chrome.tabs.sendMessage(tabId, { type: 'GET_REACHARD_PAGE_CONTEXT' }), jobTab.id);
  assert.equal(pageContext.pageContext.companyName, 'Northstar Robotics');
  assert.equal(pageContext.pageContext.jobTitle, 'Software Engineer, Robotics Data Systems');
  report.pageContext = pageContext.pageContext;
  report.checks.realContentScriptExtraction = true;
  await captureScreenshot('runtime-launcher.png', () => job.screenshot({ path: path.join(out, 'runtime-launcher.png'), animations: 'disabled' }));
  await launcher.click();
  const open = await worker.evaluate(async () => typeof chrome.sidePanel.getLayout === 'function' ? chrome.sidePanel.getLayout() : null);
  report.sidePanelLayout = open;
  const targets = (await debug.send('Target.getTargets')).targetInfos;
  report.targetsAfterLauncher = targets.map(({ type, url }) => ({ type, url }));
  const target = targets.find(target => target.url === `chrome-extension://${report.extensionId}/sidepanel.html`);
  assert.ok(target, 'Launcher must create the native side-panel Chrome target');
  // Chrome exposes its native panel as a CDP target but not a Playwright Page.
  // Attach to that actual target; do not create a second synthetic panel.
  const { sessionId } = await debug.send('Target.attachToTarget', { targetId: target.targetId, flatten: false });
  let commandId = 0;
  const pending = new Map();
  debug.on('Target.receivedMessageFromTarget', event => {
    if (event.sessionId !== sessionId) return;
    const message = JSON.parse(event.message);
    if (message.method === 'Runtime.exceptionThrown') report.errors.push({ target: target.url, error: message.params.exceptionDetails.text });
    const callback = pending.get(message.id);
    if (callback) { pending.delete(message.id); message.error ? callback.reject(new Error(message.error.message)) : callback.resolve(message.result); }
  });
  const panelCommand = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++commandId; pending.set(id, { resolve, reject });
    debug.send('Target.sendMessageToTarget', { sessionId, message: JSON.stringify({ id, method, params }) }).catch(reject);
  });
  await panelCommand('Runtime.enable');
  const evaluatePanel = async expression => {
    const result = await panelCommand('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  const panelText = await evaluatePanel(`new Promise((resolve, reject) => { const start = Date.now(); const check = () => { const text = document.querySelector('#fc-linkedin-panel')?.shadowRoot?.textContent || ''; if(text.includes('Sign in')) resolve(text); else if(Date.now() - start > 8000) reject(new Error('Panel did not show Sign in')); else requestAnimationFrame(check); }; check(); })`);
  assert.ok(panelText.includes('Software Engineer, Robotics Data Systems'));
  report.panelVisibleState = 'Recognized the local role and displayed Sign in';
  report.checks.nativePanelOpenedByToolbarAndLauncher = true;
  const accountReply = await evaluatePanel(`chrome.runtime.sendMessage({ type: 'GET_ACCOUNT_STATUS' })`);
  assert.equal(accountReply.status, 401);
  assert.equal(accountReply.action.label, 'Sign in');
  report.signedOutAccount = { status: accountReply.status, action: accountReply.action.label };
  report.checks.panelDocumentLoads = true;
  report.checks.signedOutWorkerResponse = true;
  await panelCommand('Page.enable');
  await captureScreenshot('runtime-panel-signed-out.png', async () => {
    const screenshot = await panelCommand('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    await writeFile(path.join(out, 'runtime-panel-signed-out.png'), Buffer.from(screenshot.data, 'base64'));
  });
  report.checks.panelRecognizesActiveJobAndRequiresSignIn = true;
  const secondPanel = await context.newPage();
  await secondPanel.goto(target.url, { waitUntil: 'load' });
  const responseWithTwoPanels = await secondPanel.evaluate(() => chrome.runtime.sendMessage({ type: 'GET_ACCOUNT_STATUS' }));
  report.twoPanelAccountResponse = responseWithTwoPanels;
  report.checks.twoPanelsPreserveWorkerResponse = responseWithTwoPanels?.status === 401;
  assert.equal(responseWithTwoPanels?.status, 401, 'Another panel must not intercept the worker response with null');
  assert.equal(report.errors.length, 0, 'Extension runtime must not raise page errors');
  report.checks.noPageJavaScriptErrors = true;
  report.checks.noProviderOrMailCalls = !report.network.some(request => /\/(?:api\/contacts|api\/email\/draft)|^mailto:/.test(request.url));
  // These are intercepted local fixtures at representative URLs, never live provider pages.
  report.automaticSites = [];
  const autoUrls = ['https://www.linkedin.com/jobs/view/123', 'https://boards.greenhouse.io/northstar/jobs/123', 'https://job-boards.greenhouse.io/northstar/jobs/123', 'https://jobs.lever.co/northstar/123', 'https://jobs.ashbyhq.com/northstar/123', 'https://northstar.wd1.myworkdayjobs.com/en-US/careers/job/123'];
  const autoFixture = fixture.replace('<h1>', '<a class="job-details-jobs-unified-top-card__company-name" href="https://www.linkedin.com/company/northstar/">Northstar Robotics</a><h1>');
  for (const url of autoUrls) {
    await context.route(url, route => route.fulfill({ contentType: 'text/html', body: autoFixture }));
    const automatic = await context.newPage();
    await automatic.goto(url, { waitUntil: 'domcontentloaded' });
    await automatic.getByRole('button', { name: 'Find with Reachard' }).waitFor({ timeout: 10000 });
    report.automaticSites.push({ url, automaticLauncher: true, localFixture: true });
    await automatic.close();
  }
  report.checks.namedHiringSitesStillAutomatic = true;
  await context.route('https://unlisted.example/fixture', route => route.fulfill({ contentType: 'text/html', body: fixture }));
  await job.goto('https://unlisted.example/fixture', { waitUntil: 'domcontentloaded' });
  assert.equal(await launcher.count(), 0);
  assert.equal(await canInject(jobTab.id), false, 'Cross-origin navigation must revoke the temporary access');
  report.checks.crossOriginNavigationRevokesAccess = true;
  const permissionsPage = await context.newPage();
  await permissionsPage.goto(`chrome://extensions/?id=${report.extensionId}`, { waitUntil: 'load' });
  await permissionsPage.locator('extensions-detail-view').waitFor({ timeout: 10000 });
  await captureScreenshot('runtime-permissions.png', () => permissionsPage.screenshot({ path: path.join(out, 'runtime-permissions.png'), animations: 'disabled' }));
} catch (error) {
  report.failure = error.message;
  process.exitCode = 1;
} finally {
  if (context) await context.close();
  await new Promise(resolve => server.close(resolve));
  await writeFile(path.join(out, 'runtime-report.json'), `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify({ checks: report.checks, failure: report.failure, report: path.join(out, 'runtime-report.json') }, null, 2));
