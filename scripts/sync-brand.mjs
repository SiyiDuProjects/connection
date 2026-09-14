import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const brand = JSON.parse(await readFile(new URL('brand/brand.json', root), 'utf8'));
if (typeof brand.name !== 'string' || !brand.name.trim() || /[<>\r\n]/.test(brand.name)) {
  throw new Error('brand/brand.json must contain a non-empty plain-text name.');
}
if (!/^\/images\/[A-Za-z0-9/_-]+\.png$/.test(brand.webMarkPath)
  || !/^icons\/[A-Za-z0-9_-]+\.png$/.test(brand.extensionMarkPath)) {
  throw new Error('Brand icons must use canonical local PNG paths.');
}
const header = '// Generated from brand/brand.json by scripts/sync-brand.mjs. Do not edit directly.\n';
const shared = `${header}export const BRAND_NAME = ${JSON.stringify(brand.name)};\n`;
const mark = await readFile(new URL(`extension/${brand.extensionMarkPath}`, root));
const extensionBrand = { ...brand, markDataUrl: `data:image/png;base64,${mark.toString('base64')}` };
const outputs = new Map([
  ['web/lib/brand.ts', `${shared}export const BRAND_MARK_PATH = ${JSON.stringify(brand.webMarkPath)};\n`],
  ['server/src/lib/brand.js', shared],
  ['extension-ui/brand.js', `${shared}export const BRAND_MARK_PATH = ${JSON.stringify(brand.extensionMarkPath)};\n`],
  ['extension/brand.js', `${header}globalThis.ReachardBrand = Object.freeze(${JSON.stringify(extensionBrand, null, 2)});\n`],
]);
const manifestUrl = new URL('extension/manifest.json', root);
const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
manifest.name = brand.name;
manifest.action = { ...manifest.action, default_title: `Open ${brand.name}` };
outputs.set('extension/manifest.json', `${JSON.stringify(manifest, null, 2)}\n`);
const escapeHtml = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const html = await readFile(new URL('extension/sidepanel.html', root), 'utf8');
outputs.set('extension/sidepanel.html', html
  .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(brand.name)}</title>`)
  .replace(/(<main\s+id="fc-linkedin-panel"\s+aria-label=")[^"]*(")/, `$1${escapeHtml(brand.name)}$2`));
const stale = [];
for (const [relativePath, content] of outputs) {
  const url = new URL(relativePath, root);
  const existing = await readFile(url, 'utf8').catch(() => null);
  if (existing === content) continue;
  stale.push(relativePath);
  if (!process.argv.includes('--check')) await writeFile(url, content);
}
if (process.argv.includes('--check') && stale.length) {
  throw new Error(`Brand outputs need synchronizing: ${stale.join(', ')}. Run node ${fileURLToPath(import.meta.url)}.`);
}
console.log(`Brand ${process.argv.includes('--check') ? 'verified' : 'synchronized'}: ${brand.name}`);
