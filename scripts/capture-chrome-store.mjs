import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStorePreviewServer } from './preview-chrome-store.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = path.join(root, 'artifacts/launch-20260907/store');
const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); }
catch {
  const modules = process.env.PLAYWRIGHT_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
  playwright = require(path.join(modules, 'playwright'));
}
await mkdir(out, { recursive: true });
const server = createStorePreviewServer();
await new Promise(resolve => server.listen(3027, '127.0.0.1', resolve));
const browser = await playwright.chromium.launch({ headless: true, channel: 'chrome' });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
const failures = [], requests = [];
await context.route('**/*', route => {
  const url = route.request().url();
  requests.push(url);
  if (url.startsWith('http://127.0.0.1:3027/') || url.startsWith('data:')) return route.continue();
  failures.push(`Blocked external request: ${url}`);
  return route.abort();
});
const page = await context.newPage();
page.on('pageerror', error => failures.push(error.message));
const screenshots = [];
async function capture(file, description) {
  await page.screenshot({ path: path.join(out, file), fullPage: false, animations: 'disabled' });
  screenshots.push({ file, width: 1280, height: 800, description, source: 'Current packaged extension UI in a local sample-data harness; Chrome API and provider results are simulated.' });
}
try {
  await page.goto('http://127.0.0.1:3027/', { waitUntil: 'networkidle' });
  const panel = page.frameLocator('iframe');
  await panel.getByRole('button', { name: 'Find people here' }).waitFor();
  await capture('01-current-role-1280x800.png', 'Read the role context from a job page.');
  await panel.getByRole('button', { name: 'Find people here' }).click();
  await panel.getByRole('heading', { name: 'People to contact' }).waitFor();
  await panel.getByRole('button', { name: 'Get email & draft' }).waitFor();
  await capture('02-find-people-1280x800.png', 'Review relevant professional contacts for the company.');
  await panel.getByRole('button', { name: 'Get email & draft' }).click();
  await panel.getByRole('heading', { name: 'Email draft', exact: true }).waitFor();
  await capture('03-review-draft-1280x800.png', 'Review and edit an outreach draft. Nothing is sent.');
  await panel.getByRole('button', { name: 'All contacts', exact: true }).click();
  await panel.getByText('maya.chen@example.com', { exact: true }).waitFor();
  await capture('04-work-email-1280x800.png', 'Return to a contact after work-email reveal and draft preparation.');
  await panel.getByRole('button', { name: 'Back to role', exact: true }).click();
  await panel.getByRole('button', { name: 'Personal context' }).click();
  await panel.getByRole('textbox', { name: 'Personal context' }).fill('I enjoy building robotics data tools and would love to learn about the team.');
  await panel.getByRole('heading', { name: 'Make it personal' }).click();
  await capture('05-personalize-1280x800.png', 'Set your preferred message goal, tone, length, and personal context.');

  const fixtureFrame = page.frames().find(frame => frame.url().includes('/sidepanel.html'));
  const fixtureCalls = await fixtureFrame.evaluate(() => window.__fixtureCalls || []);
  const brand = JSON.parse(await readFile(path.join(root, 'brand/brand.json'), 'utf8'));
  const logo = (await readFile(path.join(root, 'brand/mark.png'))).toString('base64');
  const safeName = String(brand.name).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  for (const [width, height, file] of [[440, 280, 'promo-small-440x280.png'], [1400, 560, 'promo-marquee-1400x560.png']]) {
    await page.setViewportSize({ width, height });
    await page.setContent(`<!doctype html><html><head><style>html,body{margin:0;width:100%;height:100%;font-family:Arial,sans-serif;color:#202429;background:#f9fafb}main{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;box-sizing:border-box;padding:28px}img{width:${width === 440 ? 76 : 126}px;height:auto;margin-bottom:${width === 440 ? 12 : 20}px}h1{margin:0;font-size:${width === 440 ? 36 : 64}px;font-weight:600;letter-spacing:-1.8px}p{max-width:620px;font-size:${width === 440 ? 17 : 30}px;line-height:1.35;color:#656d76;margin:${width === 440 ? 10 : 20}px 0 0}</style></head><body><main><img src="data:image/png;base64,${logo}" alt=""><h1>${safeName}</h1><p>Find the people behind<br>the job you want.</p></main></body></html>`);
    await page.screenshot({ path: path.join(out, file) });
  }
  await writeFile(path.join(out, 'store-icon-128.png'), await readFile(path.join(root, 'extension/icons/icon-128.png')));
  await writeFile(path.join(out, 'screenshot-report.json'), `${JSON.stringify({ screenshots, fixtureCalls, blockedRequests: failures, externalNetworkAllowed: false, requests: [...new Set(requests)], limitation: 'UI fixture evidence only; this is not proof of a native Chrome installation, provider operation, subscription or email delivery.' }, null, 2)}\n`);
  if (failures.length) throw new Error(failures.join('\n'));
  console.log(`Captured ${screenshots.length} current-UI screenshots, 2 promo tiles, and the store icon in ${out}`);
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
