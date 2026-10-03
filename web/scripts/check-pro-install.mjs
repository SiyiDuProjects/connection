import { readFileSync, statSync } from 'node:fs';

// Keep this aligned with the reviewed package.json version. hpsetup may rewrite
// package.json while upgrading, so reading that file afterward is not a guard.
const expected = '1.0.0-beta.9';
const installed = JSON.parse(readFileSync(new URL('../node_modules/@heroui-pro/react/package.json', import.meta.url))).version;

if (installed !== expected) {
  throw new Error(`HeroUI Pro version changed during installation: expected ${expected}, received ${installed}. Review and test the upgrade before deploying.`);
}
for (const entry of ['@heroui-pro/react', '@heroui-pro/react/css']) {
  if (!statSync(new URL(import.meta.resolve(entry))).isFile()) {
    throw new Error(`HeroUI Pro entry point must be a file: ${entry}`);
  }
}
console.log(`HeroUI Pro ${installed}: component code and styles are installed.`);
