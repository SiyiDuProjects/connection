import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';
import { spawnSync } from 'node:child_process';

// A deliberately small allowlist keeps development fixtures, source maps,
// submission notes, provider credentials and retired assets out of the upload.
const root = fileURLToPath(new URL('../', import.meta.url));
const brandCheck = spawnSync(process.execPath, [path.join(root, 'scripts/sync-brand.mjs'), '--check'], { encoding: 'utf8' });
assert.equal(brandCheck.status, 0, brandCheck.stderr || brandCheck.stdout || 'Brand outputs must be synchronized before packaging');
const out = path.resolve(root, process.argv[2] || 'artifacts/launch-20260907/store');
const relativeOut = path.relative(root, out);
assert.ok(relativeOut && !relativeOut.startsWith('..') && !path.isAbsolute(relativeOut), 'Output must be inside this repository');
const manifest = JSON.parse(await readFile(path.join(root, 'extension/manifest.json'), 'utf8'));
const local = value => /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\//.test(value);
manifest.host_permissions = manifest.host_permissions.filter(value => !local(value));
manifest.content_scripts = manifest.content_scripts.map(script => ({ ...script, matches: script.matches.filter(value => !local(value)) }));
manifest.externally_connectable.matches = manifest.externally_connectable.matches.filter(value => !local(value));
// Automatic recognition is limited to named hiring sites; other pages use activeTab.
delete manifest.optional_host_permissions;
delete manifest.key;
delete manifest.update_url;
const files = [...new Set([
  'brand.js', 'content.js', 'content.css', 'service_worker.js', 'web_bridge.js',
  'ui.js', 'sidepanel.html', 'sidepanel.js', 'sidepanel.css',
  'sidepanel-context.js', 'sidepanel-boot.js', 'icons/reachard.png', ...Object.values(manifest.icons)
])].sort();
assert.deepEqual(manifest.permissions.slice().sort(), ['activeTab', 'scripting', 'sidePanel', 'storage']);
assert.equal(manifest.manifest_version, 3);
assert.ok(manifest.version.split('.').every(value => /^\d+$/.test(value) && Number(value) <= 65535));
assert.ok(manifest.description.length <= 132);
assert.deepEqual(manifest.content_scripts.map(script => script.js), [['brand.js', 'content.js'], ['web_bridge.js']]);
for (const pattern of [...manifest.host_permissions, ...manifest.content_scripts.flatMap(script => script.matches)]) {
  assert.ok(!['<all_urls>', 'https://*/*', 'http://*/*', '*://*/*'].includes(pattern), 'Store package must not request all-site access');
}
assert.ok(!JSON.stringify(manifest).includes('localhost'));
assert.ok(!JSON.stringify(manifest).includes('127.0.0.1'));

const entries = [{ name: 'manifest.json', data: Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`) }];
for (const name of files) {
  assert.ok(!name.includes('..') && !path.isAbsolute(name));
  const data = await readFile(path.join(root, 'extension', name));
  if (/\.(?:js|html|css)$/.test(name)) {
    const text = data.toString('utf8');
    assert.ok(!/fixture-maya|reachard-local-fixture|__fixtureCalls/.test(text), `${name}: fixture code must not ship`);
    assert.ok(!/<script[^>]+src=["']https?:/.test(text), `${name}: remote executable script`);
    assert.ok(!/\b(?:eval\s*\(|new\s+Function\s*\()/.test(text), `${name}: dynamic executable code`);
  }
  if (name.endsWith('.png')) {
    assert.equal(data.subarray(1, 4).toString(), 'PNG', `${name}: expected a PNG icon`);
    assert.equal(data.readUInt32BE(16), data.readUInt32BE(20), `${name}: icon must be square`);
    const size = Object.entries(manifest.icons).find(([, file]) => file === name)?.[0];
    if (size) assert.equal(data.readUInt32BE(16), Number(size), `${name}: manifest icon size must match PNG dimensions`);
  }
  entries.push({ name, data });
}
for (const script of manifest.content_scripts) {
  for (const file of [...script.js, ...(script.css || [])]) assert.ok(files.includes(file), `Missing ${file}`);
}
for (const entry of entries.filter(entry => entry.name.endsWith('.html'))) {
  for (const match of entry.data.toString().matchAll(/(?:src|href)=["']([^"']+)["']/g)) assert.ok(files.includes(match[1]), `Missing panel asset ${match[1]}`);
}

const crcTable = Uint32Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
  return value >>> 0;
});
function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255];
  return (crc ^ 0xffffffff) >>> 0;
}
function zip(entries) {
  const chunks = [], directories = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name), compressed = deflateRawSync(entry.data, { level: 9 });
    const crc = crc32(entry.data), header = Buffer.alloc(30), central = Buffer.alloc(46);
    header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4); header.writeUInt16LE(0x800, 6);
    header.writeUInt16LE(8, 8); header.writeUInt16LE(0x21, 12); header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(compressed.length, 18); header.writeUInt32LE(entry.data.length, 22); header.writeUInt16LE(name.length, 26);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x800, 8); central.writeUInt16LE(8, 10); central.writeUInt16LE(0x21, 14);
    central.writeUInt32LE(crc, 16); central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
    chunks.push(header, name, compressed); directories.push(central, name);
    offset += header.length + name.length + compressed.length;
  }
  const directory = Buffer.concat(directories), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...chunks, directory, end]);
}
await mkdir(out, { recursive: true });
const packageName = `reachard-${manifest.version}-chrome-store.zip`;
const data = zip(entries), sha256 = createHash('sha256').update(data).digest('hex');
await writeFile(path.join(out, packageName), data);
await writeFile(path.join(out, 'production-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
const report = {
  package: packageName, version: manifest.version, bytes: data.length, sha256,
  checks: ['MV3', 'runtime file allowlist', 'no local manifest origins', 'no unused optional hosts', 'local executable code', 'no fixture code', 'square PNG icons', 'panel assets exist'],
  manifestDifferences: ['Removed localhost and 127.0.0.1 from API host, web bridge and external connection matches.', 'Automatic page recognition is limited to LinkedIn, Greenhouse, Lever, Ashby and Workday. Other sites use activeTab and packaged scripting after a toolbar click; no all-site or optional host grant.'],
  files: entries.map(entry => ({ path: entry.name, bytes: entry.data.length, sha256: createHash('sha256').update(entry.data).digest('hex') })),
  liveVerification: 'This package is not yet uploaded or submitted. Formal store ID and reviewer account exist; signed-in extension workflow remains a separate check.'
};
await writeFile(path.join(out, 'package-report.json'), `${JSON.stringify(report, null, 2)}\n`);
const submissionGuide = (await readFile(path.join(root, 'extension/STORE_SUBMISSION.md'), 'utf8')).replaceAll('Reachard', manifest.name);
await writeFile(path.join(out, 'submission-guide.md'), submissionGuide);
const listing = {
  name: manifest.name,
  shortDescription: manifest.description,
  detailedDescription: submissionGuide.split('**Detailed description:**')[1]?.split('**Homepage URL:**')[0]?.trim(),
  language: 'English',
  suggestedCategory: 'Workflow & Planning',
  homepageUrl: 'https://reachard.co',
  privacyPolicyUrl: 'https://reachard.co/privacy',
  supportEmail: 'support@reachard.co',
  supportPageUrl: 'https://reachard.co/support',
  termsUrl: 'https://reachard.co/terms',
  singlePurpose: submissionGuide.split('**Single purpose:**')[1]?.split('\n')[0]?.trim(),
  remoteCode: false,
  version: manifest.version
};
assert.ok(listing.detailedDescription && listing.singlePurpose, 'Submission guide must contain listing copy');
await writeFile(path.join(out, 'listing.json'), `${JSON.stringify(listing, null, 2)}\n`);
console.log(JSON.stringify({ package: path.join(out, packageName), bytes: data.length, sha256, files: entries.length }, null, 2));
