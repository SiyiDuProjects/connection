import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const out = path.join(root, 'artifacts/extension-autopopup-20260912');
await mkdir(out, { recursive: true });
const run = await mkdtemp(path.join(out, 'runtime-'));
const require = createRequire(import.meta.url);
const modules = process.env.PLAYWRIGHT_MODULES || path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules');
const { chromium } = require(path.join(modules, 'playwright'));
const executablePath = process.env.REACHARD_TEST_CHROMIUM || path.join(process.env.LOCALAPPDATA, 'ms-playwright/chromium-1237/chrome-win64/chrome.exe');
const extension = path.resolve(process.env.REACHARD_TEST_EXTENSION || path.join(root, 'extension'));
const report = { kind: 'Real unpacked extension in isolated Chromium; intercepted fictional pages, no account or paid provider requests.', extension, checks: [], errors: [] };
const fixture = (name = 'Robotics', type = 'job') => `<!doctype html><html><head><title>${name} Engineer at Northstar</title><meta property="og:site_name" content="Northstar Robotics">
${type === 'job' ? `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'JobPosting', title: `${name} Engineer`, hiringOrganization: { '@type': 'Organization', name: 'Northstar Robotics' }, description: 'Build reliable data systems for robotics research.', jobLocation: { address: { addressLocality: 'San Francisco', addressRegion: 'CA' } } })}</script>` : ''}
<style>body{margin:0;background:#fafafa;font:17px Arial;color:#202429}main{padding:72px 64px;max-width:640px}h1{font-size:44px;letter-spacing:-1.5px;font-weight:500;line-height:1.12;margin:38px 0 24px}p{line-height:1.7;color:#66717d}small{color:#007aff}.job-details-jobs-unified-top-card__company-name{font-weight:600;color:#202429}</style></head>
<body><main><small>Sample job · Real extension runtime</small><h1 class="job-details-jobs-unified-top-card__job-title">${name} Engineer</h1><p class="job-details-jobs-unified-top-card__company-name">Northstar Robotics</p><p>San Francisco, CA</p><p class="jobs-description__content">Build reliable data systems for robotics research.</p><p>This fictional page is served locally to verify automatic opening.<br>No click, account, or paid search is involved.</p></main></body></html>`;
const context = await chromium.launchPersistentContext(path.join(run, 'profile'), {
  executablePath, headless: true, viewport: { width: 1280, height: 800 },
  args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--enable-unsafe-extension-debugging', '--host-resolver-rules=MAP * ~NOTFOUND']
});
const visible = page => page.locator('#fc-linkedin-panel.fc-auto-panel:not([hidden])');
const panel = page => page.frameLocator('iframe[title="Reachard"]');
const waitTitle = (page, title) => panel(page).getByText(title, { exact: true }).first().waitFor();
async function check(name, action) { await action(); report.checks.push(name); console.log(`PASS ${name}`); }
try {
  await context.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith('chrome-extension:') || url.startsWith('data:')) return route.continue();
    if (route.request().isNavigationRequest() && new URL(url).hostname !== 'reachard.co') {
      return route.fulfill({ contentType: 'text/html', body: fixture(url.includes('role-b') ? 'Platform' : 'Robotics') });
    }
    return route.abort();
  });
  context.on('page', page => page.on('pageerror', error => report.errors.push({ url: page.url(), error: error.message })));
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const page = await context.newPage();
  await check('opens complete UI with zero clicks on a supported job page', async () => {
    await page.goto('https://jobs.lever.co/northstar/role-a');
    await visible(page).waitFor();
    await waitTitle(page, 'Robotics Engineer');
    await panel(page).getByRole('button', { name: 'Sign in', exact: true }).first().waitFor();
    await page.screenshot({ path: path.join(out, 'auto-open.png') });
  });
  await check('close collapses to a 56px square containing only a white logo', async () => {
    await panel(page).getByRole('button', { name: 'Close Reachard', exact: true }).click();
    await visible(page).waitFor({ state: 'hidden' });
    const button = page.getByRole('button', { name: 'Find with Reachard', exact: true });
    const box = await button.boundingBox();
    assert.equal(box.width, 56); assert.equal(box.height, 56);
    assert.equal((await button.textContent()).trim(), '');
    assert.equal(await button.locator('img').count(), 1);
    await page.screenshot({ path: path.join(out, 'square-logo.png') });
  });
  await check('dismissal survives page mutations and tracking URL changes', async () => {
    await page.evaluate(() => {
      document.querySelector('main').appendChild(document.createElement('p')).textContent = 'Additional details';
      history.pushState({}, '', '?utm_source=test#details');
    });
    await page.waitForTimeout(2000);
    assert.equal(await visible(page).count(), 0);
  });
  await check('logo reopens the panel and remains draggable', async () => {
    const button = page.getByRole('button', { name: 'Find with Reachard', exact: true });
    const box = await button.boundingBox();
    await page.mouse.move(box.x + 25, box.y + 25);
    await page.mouse.down(); await page.mouse.move(box.x + 25, box.y + 115, { steps: 8 }); await page.mouse.up();
    assert.equal(await visible(page).count(), 0);
    assert.ok((await button.boundingBox()).y > box.y + 60);
    await button.click(); await visible(page).waitFor();
    await waitTitle(page, 'Robotics Engineer');
  });
  await check('tracking changes do not expose a duplicate launcher beside an open panel', async () => {
    await page.evaluate(() => history.pushState({}, '', '?utm_source=next'));
    await page.waitForTimeout(1800);
    assert.equal(await page.locator('#fc-linkedin-root').isVisible(), false);
  });
  await check('a different SPA job automatically reopens with fresh context', async () => {
    await panel(page).getByRole('button', { name: 'Close Reachard', exact: true }).click();
    await page.evaluate(() => {
      history.pushState({}, '', '/northstar/role-b');
      document.querySelector('h1').textContent = 'Platform Engineer';
      const node = document.querySelector('script[type="application/ld+json"]');
      const data = JSON.parse(node.textContent); data.title = 'Platform Engineer'; node.textContent = JSON.stringify(data);
    });
    await visible(page).waitFor(); await waitTitle(page, 'Platform Engineer');
  });
  await check('embedded panels retain their own tab context', async () => {
    const second = await context.newPage();
    await second.goto('https://jobs.ashbyhq.com/northstar/role-a');
    await waitTitle(second, 'Robotics Engineer');
    await page.bringToFront(); await waitTitle(page, 'Platform Engineer');
    await second.close();
  });
  await check('auto-opens on LinkedIn, Greenhouse, Ashby, and Workday', async () => {
    for (const url of ['https://www.linkedin.com/jobs/view/123', 'https://boards.greenhouse.io/northstar/jobs/123', 'https://job-boards.greenhouse.io/northstar/jobs/123', 'https://jobs.ashbyhq.com/northstar/role-a', 'https://northstar.wd5.myworkdayjobs.com/en-US/jobs/job/role-a']) {
      await page.goto(url); await visible(page).waitFor(); await waitTitle(page, 'Robotics Engineer');
    }
  });
  await check('no auto-popup on LinkedIn feed, authentication, or unlisted sites', async () => {
    for (const url of ['https://www.linkedin.com/feed/', 'https://jobs.lever.co/login', 'https://example.com/jobs/role-a']) {
      await page.goto(url); await page.waitForTimeout(500);
      assert.equal(await visible(page).count(), 0, url);
    }
  });
  await check('browser toolbar still activates unlisted pages in the native side panel', async () => {
    const debug = await context.browser().newBrowserCDPSession();
    const targets = await debug.send('Target.getTargets', { filter: [{ type: 'tab' }] });
    const target = targets.targetInfos.find(item => item.url === page.url());
    await debug.send('Extensions.triggerAction', { id: worker.url().split('/')[2], targetId: target.targetId });
    await page.getByRole('button', { name: 'Find with Reachard', exact: true }).waitFor();
    const all = await debug.send('Target.getTargets');
    assert.ok(all.targetInfos.some(item => item.url === worker.url().replace('service_worker.js', 'sidepanel.html')));
    assert.equal(await visible(page).count(), 0);
  });
  await check('small viewport panel stays within page bounds', async () => {
    await page.setViewportSize({ width: 390, height: 700 });
    await page.goto('https://jobs.lever.co/northstar/role-a'); await waitTitle(page, 'Robotics Engineer');
    const box = await visible(page).boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= 390 && box.y + box.height <= 700);
    await page.screenshot({ path: path.join(out, 'auto-open-narrow.png') });
  });
  assert.deepEqual(report.errors, []);
} catch (error) { report.failure = error.stack; throw error; }
finally { await writeFile(path.join(out, 'runtime-report.json'), JSON.stringify(report, null, 2)); await context.close(); }
