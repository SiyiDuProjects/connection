import assert from 'node:assert/strict';
import { test } from 'node:test';
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function check(t, version, runtime = true, directoryEntry = null) {
  const root = mkdtempSync(join(tmpdir(), 'reachard-env-fixture-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const dir of ['scripts', 'web/scripts', 'web/node_modules', 'server/node_modules', 'bin']) mkdirSync(join(root, dir), { recursive: true });
  copyFileSync(new URL('./check-local-env.sh', import.meta.url), join(root, 'scripts/check-local-env.sh'));
  copyFileSync(new URL('../web/scripts/check-pro-install.mjs', import.meta.url), join(root, 'web/scripts/check-pro-install.mjs'));
  for (const area of ['web', 'server']) writeFileSync(join(root, area, '.env'), '# fixture only\n');
  // Version probes are local shims; they never run a package manager or access credentials.
  const quotedNode = `'${process.execPath.replaceAll("'", "'\\''")}'`;
  writeFileSync(join(root, 'bin/node'), `#!/bin/sh\nexec ${quotedNode} "$@"\n`, { mode: 0o755 });
  for (const tool of ['npm', 'corepack', 'pnpm']) writeFileSync(join(root, 'bin', tool), '#!/bin/sh\nprintf "fixture-version\\n"\n', { mode: 0o755 });
  if (version) {
    const pkg = join(root, 'web/node_modules/@heroui-pro/react');
    mkdirSync(pkg, { recursive: true });
    writeFileSync(join(pkg, 'package.json'), JSON.stringify({ name: '@heroui-pro/react', version,
      type: 'module', exports: { '.': './index.js', './css': './index.css' } }));
    if (runtime) {
      for (const file of ['index.js', 'index.css']) {
        if (file === directoryEntry) mkdirSync(join(pkg, file));
        else writeFileSync(join(pkg, file), file === 'index.js' ? 'export {};' : '');
      }
    }
  }
  return spawnSync('/bin/sh', [join(root, 'scripts/check-local-env.sh')], {
    encoding: 'utf8', env: { PATH: `${join(root, 'bin')}:/usr/bin:/bin` },
  });
}

test('migration check rejects a stale licensed runtime even when dependency directories exist', t => {
  const result = check(t, '1.0.0-beta.8');
  assert.equal(result.status, 1);
  assert.match(result.stdout, /warn.*HeroUI Pro/);
  assert.doesNotMatch(result.stdout, /Local environment looks ready/);
});

test('a package version alone does not prove that the licensed component files are installed', t => {
  const result = check(t, '1.0.0-beta.9', false);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /check-pro-install\.mjs/);
});

test('missing Pro package reports an actionable local warning', t => {
  const result = check(t, null);
  assert.equal(result.status, 1);
  assert.match(result.stdout, /cloud-build\.md/);
});

test('the reviewed version with component and CSS entry points passes', t => {
  const result = check(t, '1.0.0-beta.9');
  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /Local environment looks ready/);
});

for (const file of ['index.js', 'index.css']) {
  test(`an export pointing to a ${file} directory cannot pass the readiness check`, t => {
    const result = check(t, '1.0.0-beta.9', true, file);
    assert.equal(result.status, 1);
    assert.match(result.stdout, /warn.*HeroUI Pro/);
    assert.doesNotMatch(result.stdout, /Local environment looks ready/);
  });
}
