import { accessSync, readFileSync } from 'node:fs';

// Keep this aligned with the reviewed package.json version. hpsetup may rewrite
// package.json while upgrading, so reading that file afterward is not a guard.
const expected = '1.0.0-beta.8';
const installed = JSON.parse(readFileSync(new URL('../node_modules/@heroui-pro/react/package.json', import.meta.url))).version;

if (installed !== expected) {
  throw new Error(`HeroUI Pro version changed during installation: expected ${expected}, received ${installed}. Review and test the upgrade before deploying.`);
}
accessSync(new URL(import.meta.resolve('@heroui-pro/react')));
accessSync(new URL(import.meta.resolve('@heroui-pro/react/css')));
console.log(`HeroUI Pro ${installed}: component code and styles are installed.`);
