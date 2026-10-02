import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const out = path.join(root, 'artifacts/retest-20260916');
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'));
const executablePath = path.join(process.env.LOCALAPPDATA, 'ms-playwright/chromium-1237/chrome-win64/chrome.exe');
const extension = path.join(out, 'extension-local');
await mkdir(out, { recursive: true });
const report = { checks: [], errors: [], screenshots: [], limitations: ['LinkedIn uses recorded DOM structure with fictional content, not a signed-in LinkedIn session.', 'Real local registration/database/server/Chrome extension APIs; mock contact provider, template draft, no live spend.', 'Not a Chrome Web Store install.'] };
const context = await chromium.launchPersistentContext(path.join(out, `browser-${Date.now()}`), { executablePath, headless: true, viewport: { width: 1280, height: 900 }, args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`, '--enable-unsafe-extension-debugging'] });
const check = name => { report.checks.push(name); console.log(`PASS ${name}`); };
const classic = `<!doctype html><main><aside><a href="/jobs/view/999/">Wrong list title</a></aside><div class="jobs-search__job-details--container"><div class="job-details-jobs-unified-top-card"><h1 class="job-details-jobs-unified-top-card__job-title"><a href="/jobs/view/123/">Graduate Engineer</a></h1><div class="job-details-jobs-unified-top-card__company-name"><a href="/company/northstar/">Northstar</a></div><p class="job-details-jobs-unified-top-card__primary-description-container">Berkeley, CA · 2 days ago</p><div><button class="jobs-apply-button" aria-label="Apply to Graduate Engineer">Apply</button><button class="jobs-save-button">Save</button></div></div><h2>About the job</h2><div class="jobs-description__content">Build reliable systems.<p>Collaborate with engineers.</p></div></div></main>`;
const modern = `<!doctype html><main><aside><a href="/jobs/view/999/">Wrong list title</a></aside><section id="selected-job"><div id="job-card"><a href="/company/northstar/life/" aria-label="Company, Northstar.">Northstar</a><p><a href="/jobs/view/123/">Graduate Engineer</a></p><p>New York, NY · Reposted 4 days ago · 10 applicants</p><div id="actions"><div><a aria-label="Apply on company website" href="https://example.test/apply">Apply</a></div><div><button aria-label="Save the job">Save</button></div><div class="simplify-jobs-shadow-root"></div></div></div><div><div><h2>About the job</h2></div><p><span data-testid="expandable-text-box">Build reliable systems.<br><br>Collaborate with engineers.</span></p></div></section></main>`;
await context.route('**/*', route => {
  const url = new URL(route.request().url());
  if (url.hostname === 'www.linkedin.com') return route.fulfill({ contentType: 'text/html; charset=utf-8', body: `${url.pathname.includes('search-results') ? modern : classic}<style>body{font:16px Arial;margin:40px;background:#f5f5f5}main{max-width:900px;margin:auto}aside{float:left;width:230px}section,.jobs-search__job-details--container{margin-left:250px;padding:28px;background:white}#actions{display:flex;align-items:center;flex-wrap:wrap;gap:8px}h1{font-size:24px}</style>` });
  if (['127.0.0.1','localhost'].includes(url.hostname) || ['chrome-extension:','data:'].includes(url.protocol)) return route.continue();
  return route.abort();
});
try {
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).hostname;
  report.extensionId = extensionId;
  const web = await context.newPage();
  web.on('pageerror', error => report.errors.push(error.message));
  const screenshot = async (page, name) => { await page.screenshot({ path: path.join(out, name), fullPage: true, animations: 'disabled' }); report.screenshots.push(name); };
  const testEmail = `retest-${Date.now()}@reachard.test`;
  const register = async () => {
    await web.goto('http://127.0.0.1:3000/sign-up', { timeout: 60000 });
    await web.getByRole('textbox', { name: 'Email address' }).fill(testEmail);
    await web.getByLabel('Password', { exact: true }).fill('LocalOnly!23456');
    await web.getByRole('button', { name: 'Continue', exact: true }).click();
    await web.waitForURL('**/onboarding**', { timeout: 60000 });
  };
  await register(); check('Fake email uses real registration and reaches onboarding');
  await web.getByLabel('Full name', { exact: true }).fill('Reachard Tester');
  await web.getByRole('combobox', { name: 'School or affiliation' }).fill('Berkeley');
  await web.getByRole('option', { name: /University of California, Berkeley/ }).waitFor();
  await web.getByRole('option', { name: /University of California, Berkeley/ }).hover();
  await screenshot(web, 'school-suggestions.png');
  await web.getByRole('option', { name: /University of California, Berkeley/ }).click();
  await web.getByLabel('A little about you').fill('Physics student interested in engineering systems.');
  await web.getByRole('button', { name: 'Continue to dashboard' }).click();
  await web.waitForURL('**/dashboard', { timeout: 30000 });
  await web.getByText('Extension installed', { exact: true }).first().waitFor({ timeout: 15000 });
  assert.equal(await web.getByText('Add to Chrome', { exact: true }).count(), 0);
  const account = await web.evaluate(async () => (await fetch('/api/account')).json());
  assert.equal(account.settings.school, 'University of California, Berkeley');
  assert.ok(account.settings.defaultSearchPreferences.school.directoryId);
  check('School selection persists canonical identity; installed Dashboard offers next step');
  await screenshot(web, 'dashboard-installed.png');
  // Wait for the actual website bridge to mint/store a token; no injected credentials.
  for (let n=0;n<30;n++) { const connected = await worker.evaluate(async () => Boolean((await chrome.storage.local.get('extensionApiToken')).extensionApiToken)); if (connected) break; await new Promise(r => setTimeout(r, 200)); }
  assert.ok(await worker.evaluate(async () => Boolean((await chrome.storage.local.get('extensionApiToken')).extensionApiToken)));
  check('Automatic website-to-extension login works');
  for (let batch = 0; batch < 5; batch++) {
    const [siteStatuses, panelStatuses] = await Promise.all([
      web.evaluate(() => Promise.all(Array.from({length:3}, async () => (await fetch('/api/account')).status))),
      worker.evaluate(async () => {
        const {extensionApiToken} = await chrome.storage.local.get('extensionApiToken');
        return Promise.all(Array.from({length:3}, async () => (await fetch('http://127.0.0.1:8787/api/account', {headers:{Authorization:`Bearer ${extensionApiToken}`}})).status));
      }),
    ]);
    assert.ok([...siteStatuses, ...panelStatuses].every(status => status === 200), JSON.stringify({siteStatuses,panelStatuses}));
  }
  check('Concurrent website and extension account reads share the isolated database reliably');
  const job = await context.newPage();
  job.on('pageerror', error => report.errors.push(error.message));
  const readJob = () => worker.evaluate(async () => { const [tab] = await chrome.tabs.query({ active:true, lastFocusedWindow:true }); return chrome.tabs.sendMessage(tab.id, { type:'GET_REACHARD_PAGE_CONTEXT' }); });
  for (const url of ['https://www.linkedin.com/jobs/search/?currentJobId=123','https://www.linkedin.com/jobs/search/','https://www.linkedin.com/jobs/search-results/?currentJobId=123']) {
    await job.goto(url); await job.bringToFront();
    await job.getByRole('button', { name:'Find people with Reachard' }).waitFor();
    const { pageContext } = await readJob();
    assert.equal(pageContext.jobTitle, 'Graduate Engineer');
    assert.equal(pageContext.companyName, 'Northstar');
    assert.ok(pageContext.jobLocation.includes(url.includes('search-results') ? 'New York' : 'Berkeley'), JSON.stringify(pageContext));
    assert.ok(pageContext.jobDescription.includes('Collaborate with engineers.'));
    assert.ok(pageContext.jobDescription.includes('\n'), 'Paragraph boundaries retained');
    assert.equal(await job.locator('#reachard-job-action').count(),1);
    assert.equal(await job.locator('#fc-linkedin-root').count(),0);
    check(`Correct selected role, location, description and one in-page button: ${new URL(url).pathname}${new URL(url).search}`);
  }
  assert.equal(await job.locator('.simplify-jobs-shadow-root').count(),1);
  await screenshot(job, 'linkedin-inline-button.png');
  await job.evaluate(() => { const card=document.querySelector('#job-card'); card.querySelector('a[href*="/jobs/view/"]').textContent='Data Engineer'; });
  await new Promise(r=>setTimeout(r,600));
  assert.equal((await readJob()).pageContext.jobTitle,'Data Engineer');
  await job.evaluate(() => document.querySelector('#reachard-job-action').remove());
  await job.getByRole('button', {name:'Find people with Reachard'}).waitFor();
  check('Text hydration and removed action recover without duplicate buttons');
  await job.getByRole('button', {name:'Find people with Reachard'}).click();
  const debug = await context.newCDPSession(job);
  let target;
  for(let n=0;n<30;n++){target=(await debug.send('Target.getTargets')).targetInfos.find(t=>t.url===`chrome-extension://${extensionId}/sidepanel.html`);if(target)break;await new Promise(r=>setTimeout(r,200));}
  assert.ok(target, 'A real native side panel opens from the in-page click');
  const {sessionId}=await debug.send('Target.attachToTarget',{targetId:target.targetId,flatten:false});
  let seq=0;const pending=new Map();
  debug.on('Target.receivedMessageFromTarget', e=>{if(e.sessionId!==sessionId)return;const m=JSON.parse(e.message);const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(new Error(m.error.message)):p.resolve(m.result);}});
  const cmd=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});debug.send('Target.sendMessageToTarget',{sessionId,message:JSON.stringify({id,method,params})}).catch(reject);});
  const evaluate=async expression=>{const r=await cmd('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw new Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const waitText= text => evaluate(`new Promise((resolve,reject)=>{const start=Date.now();const tick=()=>{const el=document.querySelector('#fc-linkedin-panel')?.shadowRoot;if(el?.textContent.includes(${JSON.stringify(text)}))resolve(true);else if(Date.now()-start>20000)reject(new Error('Missing panel text'));else setTimeout(tick,100)};tick()})`);
  const press= text=>evaluate(`(()=>{const root=document.querySelector('#fc-linkedin-panel').shadowRoot;const button=[...root.querySelectorAll('button')].find(b=>b.textContent.includes(${JSON.stringify(text)}));if(!button)throw new Error('Missing button');button.click();})()`);
  await waitText('Find people'); await press('Find people'); await waitText('People to contact'); await waitText('Jane Doe');
  const metrics=await evaluate(`(()=>{const r=document.querySelector('#fc-linkedin-panel').shadowRoot;return {contacts:r.querySelectorAll('.ep-person').length,actions:[...r.querySelectorAll('.ep-reveal')].filter(b=>b.getClientRects().length).length,overflow:r.querySelector('.ep-scroll').scrollWidth>r.querySelector('.ep-scroll').clientWidth};})()`);
  assert.equal(metrics.contacts, metrics.actions); assert.ok(metrics.contacts>0); assert.equal(metrics.overflow,false);
  const shot=await cmd('Page.captureScreenshot');await writeFile(path.join(out,'native-contact-results.png'),Buffer.from(shot.data,'base64'));report.screenshots.push('native-contact-results.png');
  check('Native side panel searches through local server; every result exposes an action');
  await press('Get email & draft'); await waitText('Open in email app');
  const draft=await evaluate(`document.querySelector('#fc-linkedin-panel').shadowRoot.textContent`);
  assert.ok(draft.includes('@example.test'));
  check('Reveal and draft complete with reserved sample email; no email sent');
  await job.evaluate(() => history.pushState({},'', '/jobs/search-results/?currentJobId=456'));
  await new Promise(r=>setTimeout(r,1700));
  assert.equal((await readJob()).pageContext,null, 'A stale detail must not be assigned to the newly selected job');
  await job.getByRole('button',{name:'Find with Reachard'}).waitFor();
  assert.equal(await job.locator('#reachard-job-action').count(),0);
  await job.evaluate(() => { const a=document.querySelector('#job-card a[href*="/jobs/view/"]');a.href='/jobs/view/456/';a.textContent='Robotics Engineer'; });
  await job.getByRole('button',{name:'Find people with Reachard'}).waitFor();
  assert.equal((await readJob()).pageContext.jobTitle,'Robotics Engineer');
  check('SPA job changes clear stale context and recover after the selected detail hydrates');
  await job.evaluate(() => history.pushState({},'', '/feed/'));
  await new Promise(r=>setTimeout(r,1700));
  assert.equal(await job.locator('#reachard-job-action, #fc-linkedin-root').count(),0);
  check('Leaving jobs removes the launcher');
  await web.bringToFront();
  await web.getByRole('button',{name:'Restart registration'}).click();
  await web.waitForURL('**/sign-up', { timeout:20000 });
  assert.equal(await worker.evaluate(async () => Boolean((await chrome.storage.local.get('extensionApiToken')).extensionApiToken)),false);
  await register();
  check('Same fake email can register again after resetting');
  for (let repeat=0; repeat<3; repeat++) {
    await web.getByRole('button',{name:'Restart registration'}).click();
    await web.waitForURL('**/sign-up');
    if (repeat < 2) await register();
  }
  const denied=await web.request.post('http://127.0.0.1:3000/api/local-test/reset',{headers:{origin:'https://outside.example'}});
  assert.equal(denied.status(),403); check('Local reset rejects foreign origins');
} catch(error) { report.failure=error.stack; process.exitCode=1; console.error(error.stack); }
finally { await context.close(); await writeFile(path.join(out,'browser-report.json'),JSON.stringify(report,null,2)); }
