import assert from 'node:assert/strict';
import { test } from 'node:test';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const reviewed = '1.0.0-beta.9';
function install(t, options = {}) {
  const root = mkdtempSync(join(tmpdir(), 'reachard-pro-fixture-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const path of ['scripts', 'node_modules/hpsetup/src', 'node_modules/@heroui-pro/react']) {
    mkdirSync(join(root, path), { recursive: true });
  }
  for (const name of ['install-reviewed-pro.mjs', 'check-pro-install.mjs']) {
    copyFileSync(new URL(name, import.meta.url), join(root, 'scripts', name));
  }
  const manifest = JSON.stringify({ dependencies: { '@heroui-pro/react': options.requested ?? reviewed } });
  writeFileSync(join(root, 'package.json'), manifest);
  writeFileSync(join(root, 'pnpm-lock.yaml'), 'unchanged fixture lock');
  const target = join(root, 'node_modules/@heroui-pro/react');
  writeFileSync(join(target, 'package.json'), JSON.stringify({ version: options.installed ?? reviewed }));
  writeFileSync(join(target, 'index.js'), 'original runtime');
  writeFileSync(join(root, 'node_modules/hpsetup/package.json'), JSON.stringify({ name: 'hpsetup', type: 'module', version: options.helper ?? '4.7.1' }));
  writeFileSync(join(root, 'node_modules/hpsetup/src/constants.js'), "export const PRODUCTS = { react: { slug: 'react' } };\n");
  writeFileSync(join(root, 'node_modules/hpsetup/src/download.js'), `
    import { mkdirSync, writeFileSync } from 'node:fs';
    import { join } from 'node:path';
    export async function downloadFromProxy(product, version, target, key, noCache, ci) {
      writeFileSync('download-call.json', JSON.stringify({ product, version, noCache, ci }));
      if (process.env.FIXTURE_ERROR) throw new Error('provider secret hp_abc123 authenticated URL');
      const pkg = { name: '@heroui-pro/react', type: 'module', version: process.env.FIXTURE_VERSION,
        exports: { '.': './index.js', './css': './index.css' } };
      writeFileSync(join(target, 'package.json'), JSON.stringify(pkg));
      writeFileSync(join(target, 'index.js'), 'export {};');
      if (process.env.FIXTURE_CSS === 'directory') mkdirSync(join(target, 'index.css'));
      else if (process.env.FIXTURE_CSS !== 'missing') writeFileSync(join(target, 'index.css'), '/* licensed fixture */');
    }
  `);
  const result = spawnSync(process.execPath, [join(root, 'scripts/install-reviewed-pro.mjs')], {
    cwd: root, encoding: 'utf8', env: { PATH: process.env.PATH, HEROUI_KEY: options.key ?? 'hp_abc123',
      FIXTURE_VERSION: options.archive ?? reviewed, FIXTURE_CSS: options.css ?? 'file', FIXTURE_ERROR: options.error ? 'yes' : '' },
  });
  assert.equal(readFileSync(join(root, 'package.json'), 'utf8'), manifest);
  assert.equal(readFileSync(join(root, 'pnpm-lock.yaml'), 'utf8'), 'unchanged fixture lock');
  assert.doesNotMatch(result.stdout + result.stderr, /hp_abc123|authenticated URL/);
  return { root, target, result };
}

test('downloads only reviewed beta.9 through the existing helper and preserves dependency files', t => {
  const { root, target, result } = install(t);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(readFileSync(join(root, 'download-call.json'))), {
    product: { slug: 'react' }, version: reviewed, noCache: false, ci: true,
  });
  assert.equal(readFileSync(join(target, 'index.js'), 'utf8'), 'export {};');
});

for (const [name, options] of Object.entries({
  'unexpected archive version': { archive: '1.0.0-beta.10' },
  'missing CSS': { css: 'missing' },
  'directory export': { css: 'directory' },
  'provider failure': { error: true },
  'unreviewed helper': { helper: '4.8.0' },
  'stale local package': { installed: '1.0.0-beta.8' },
  'changed manifest pin': { requested: '1.0.0-beta.10' },
  'missing key': { key: '' },
})) {
  test(`${name} fails without replacing the application runtime`, t => {
    const { target, result } = install(t, options);
    assert.equal(result.status, 1);
    assert.equal(readFileSync(join(target, 'index.js'), 'utf8'), 'original runtime');
  });
}
