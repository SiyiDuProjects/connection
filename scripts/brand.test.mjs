import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import test from 'node:test';

test('one brand edit synchronizes all distributable names without changing service identities', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'reachard-brand-'));
  try {
    for (const part of ['scripts', 'brand', 'web/lib', 'server/src/lib', 'extension-ui', 'extension/icons']) {
      await mkdir(path.join(directory, part), { recursive: true });
    }
    for (const part of ['scripts/sync-brand.mjs', 'brand/brand.json', 'extension/manifest.json', 'extension/sidepanel.html', 'extension/icons/reachard.png']) {
      await copyFile(new URL(`../${part}`, import.meta.url), path.join(directory, part));
    }
    const configPath = path.join(directory, 'brand/brand.json');
    const config = JSON.parse(await readFile(configPath, 'utf8'));
    config.name = 'reachard future';
    await writeFile(configPath, JSON.stringify(config));
    const originalManifest = JSON.parse(await readFile(path.join(directory, 'extension/manifest.json'), 'utf8'));
    execFileSync(process.execPath, [path.join(directory, 'scripts/sync-brand.mjs')]);
    for (const part of ['web/lib/brand.ts', 'server/src/lib/brand.js', 'extension-ui/brand.js', 'extension/brand.js', 'extension/sidepanel.html']) {
      assert.ok((await readFile(path.join(directory, part), 'utf8')).includes(config.name), part);
    }
    const manifest = JSON.parse(await readFile(path.join(directory, 'extension/manifest.json'), 'utf8'));
    assert.equal(manifest.name, config.name);
    assert.equal(manifest.action.default_title, `Open ${config.name}`);
    assert.deepEqual(manifest.host_permissions, originalManifest.host_permissions);
    assert.deepEqual(manifest.externally_connectable, originalManifest.externally_connectable);
    assert.deepEqual(manifest.icons, originalManifest.icons);
    execFileSync(process.execPath, [path.join(directory, 'scripts/sync-brand.mjs'), '--check']);
  } finally {
    const resolved = path.resolve(directory);
    assert.ok(resolved.startsWith(path.resolve(tmpdir()) + path.sep) && path.basename(resolved).startsWith('reachard-brand-'));
    await rm(resolved, { recursive: true, force: true });
  }
});

test('a web-only deployment can build from validated generated brand files', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'reachard-brand-web-'));
  try {
    for (const part of ['web/scripts', 'web/lib']) await mkdir(path.join(directory, part), { recursive: true });
    for (const part of ['web/scripts/sync-brand.mjs', 'web/lib/brand.ts']) {
      await copyFile(new URL(`../${part}`, import.meta.url), path.join(directory, part));
    }
    const command = path.join(directory, 'web/scripts/sync-brand.mjs');
    execFileSync(process.execPath, [command]);
    await writeFile(path.join(directory, 'web/lib/brand.ts'), 'export const BRAND_NAME = "stale";');
    assert.throws(() => execFileSync(process.execPath, [command], { stdio: 'pipe' }));
  } finally {
    const resolved = path.resolve(directory);
    assert.ok(resolved.startsWith(path.resolve(tmpdir()) + path.sep) && path.basename(resolved).startsWith('reachard-brand-web-'));
    await rm(resolved, { recursive: true, force: true });
  }
});
