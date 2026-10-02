import { mkdir, readFile, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('..', import.meta.url));
const out = path.join(root, 'artifacts/retest-20260916/extension-local');
const manifest = JSON.parse(await readFile(path.join(root, 'extension/manifest.json'), 'utf8'));
manifest.name = 'Reachard Local Test';
const localOrigin = value => /^http:\/\/(localhost|127\.0\.0\.1):/.test(value);
manifest.host_permissions = manifest.host_permissions.filter(localOrigin);
manifest.externally_connectable.matches = manifest.externally_connectable.matches.filter(localOrigin);
for (const script of manifest.content_scripts) {
  if (script.js.includes('web_bridge.js')) script.matches = script.matches.filter(localOrigin);
}
for (const file of ['brand.js','content.js','content.css','service_worker.js','web_bridge.js','ui.js','sidepanel.html','sidepanel.js','sidepanel.css','sidepanel-context.js','sidepanel-boot.js','icons/reachard.png',...Object.values(manifest.icons)]) {
  const target = path.join(out, file); await mkdir(path.dirname(target), { recursive: true });
  if (file === 'service_worker.js') {
    const source = await readFile(path.join(root, 'extension', file), 'utf8');
    await writeFile(target, source.replace('const DEFAULT_API_BASE_URL = "https://contacts.reachard.co";', 'const DEFAULT_API_BASE_URL = "http://127.0.0.1:8787";').replace('const DEFAULT_WEB_BASE_URL = "https://reachard.co";', 'const DEFAULT_WEB_BASE_URL = "http://127.0.0.1:3000";'));
  } else if (file === 'ui.js') {
    const source = await readFile(path.join(root, 'extension', file), 'utf8');
    await writeFile(target, source.replaceAll('https://reachard.co/dashboard/billing', 'http://127.0.0.1:3000/dashboard/billing'));
  } else await copyFile(path.join(root, 'extension', file), target);
}
await writeFile(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log(`Local-only extension ${manifest.version}: ${out}`);
