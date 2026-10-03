import { cpSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// hpsetup's CLI upgrades to latest even with a frozen lockfile. Its pinned
// distribution helper accepts an exact version and uses the same licensed CDN.
const expected = '1.0.0-beta.9';
const root = fileURLToPath(new URL('..', import.meta.url));
const guard = join(root, 'scripts/check-pro-install.mjs');
const metadata = path => JSON.parse(readFileSync(path, 'utf8'));
let staging;
try {
  if (metadata(join(root, 'package.json')).dependencies['@heroui-pro/react'] !== expected) {
    throw new Error('Review the requested Pro version before installing.');
  }
  const helper = metadata(new URL('../node_modules/hpsetup/package.json', import.meta.url));
  if (helper.version !== '4.7.1') throw new Error('Unreviewed distribution helper.');
  const target = realpathSync(join(root, 'node_modules/@heroui-pro/react'));
  if (metadata(join(target, 'package.json')).version !== expected) {
    throw new Error('Restore dependencies from the frozen lockfile first.');
  }
  const key = process.env.HEROUI_KEY?.trim();
  if (!key || !/^hp_[0-9a-f]+$/.test(key)) throw new Error('Missing or malformed installation key.');

  const { PRODUCTS } = await import('hpsetup/src/constants.js');
  const { downloadFromProxy } = await import('hpsetup/src/download.js');
  staging = mkdtempSync(join(tmpdir(), 'reachard-reviewed-pro-'));
  const stagedPackage = join(staging, 'node_modules/@heroui-pro/react');
  mkdirSync(stagedPackage, { recursive: true });
  await downloadFromProxy(PRODUCTS.react, expected, stagedPackage, key, false, true);

  // Validate the actual archive before copying anything into the application.
  mkdirSync(join(staging, 'scripts'));
  cpSync(guard, join(staging, 'scripts/check-pro-install.mjs'));
  execFileSync(process.execPath, [join(staging, 'scripts/check-pro-install.mjs')], { stdio: 'pipe' });
  cpSync(stagedPackage, target, { recursive: true, force: true });
  execFileSync(process.execPath, [guard], { stdio: 'inherit' });
} catch {
  // Do not print provider error bodies, authenticated URLs, or key values.
  console.error('Reviewed Pro installation failed. Check the frozen dependency versions, HEROUI_KEY and the Verify reviewed Pro distribution workflow.');
  process.exitCode = 1;
} finally {
  if (staging) rmSync(staging, { recursive: true, force: true });
}
