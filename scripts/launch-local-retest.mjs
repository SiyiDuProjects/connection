import { spawn } from 'node:child_process';
import { access, mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const url = 'http://127.0.0.1:3000/sign-up';
const cache = path.join(process.env.LOCALAPPDATA, 'ms-playwright');
const versions = (await readdir(cache)).filter(name => /^chromium-\d+$/.test(name)).sort((a,b) => Number(b.split('-')[1]) - Number(a.split('-')[1]));
const browser = path.join(cache, versions[0] || 'missing', 'chrome-win64/chrome.exe');
await access(browser);
async function localPage() {
  try { return await (await fetch(url, { signal: AbortSignal.timeout(2500) })).text(); }
  catch { return ''; }
}
let html = await localPage();
if (!html) {
  await import('../web/scripts/local-test.mjs');
  for (let n=0; n<60 && !html; n++) {
    await new Promise(resolve => setTimeout(resolve, 1000));
    html = await localPage();
  }
}
if (!html.includes('Sample contacts, no real messages.')) throw new Error('Local test mode is not ready. No browser was opened.');
await import('./prepare-local-test-extension.mjs');
const extension = path.join(root, 'artifacts/retest-20260916/extension-local');
const profile = path.join(root, 'artifacts/retest-20260916/manual-test-browser');
await mkdir(profile, { recursive: true });
const child = spawn(browser, [
  `--user-data-dir=${profile}`, `--disable-extensions-except=${extension}`, `--load-extension=${extension}`,
  '--no-first-run', '--no-default-browser-check', '--new-window', url,
], { detached: true, stdio: 'ignore', windowsHide: false });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.unref();
console.log('Opened a separate test browser with Reachard 0.7.5 and local registration. Your normal Chrome profile is unchanged.');
