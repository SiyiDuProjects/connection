import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstat, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { gzipSync, gunzipSync } from 'node:zlib';

// A private integration snapshot of this working tree, not a Git commit or a
// public release. No environment file is read except a validated .env.example.
// The script uses Node's built-ins only; it does not call providers or deploy.
const root = fileURLToPath(new URL('../', import.meta.url));
const outputRoot = path.join(root, 'artifacts/launch-20260907/release');
const scope = ['web', 'server', 'extension', 'extension-ui', 'scripts', 'brand', '.github', 'README.md', 'AGENTS.md', '.gitignore'];
const privateTemplatePaths = ['web/components/heroui-dashboard-template', 'web/app/template-preview'];
const skippedDirectories = /^(?:node_modules(?:\..*)?|\.next(?:-.*)?|\.git|\.agents|\.codex|\.vercel|\.vscode|\.turbo|\.cache|\.pnpm-store|\.yarn|\.pnp|coverage|dist|build|out|output|artifacts|\.archive|\.playwright-cli|postgres_data)$/i;
const sourceExtensions = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx', '.css', '.json', '.md', '.html', '.svg', '.png', '.jpg', '.jpeg', '.webp', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.sh', '.cmd', '.ps1', '.yml', '.yaml', '.toml', '.sql']);
const specialFiles = new Set(['Dockerfile', 'LICENSE', '.gitignore', '.dockerignore', '.env.example']);
const sha256 = value => createHash('sha256').update(value).digest('hex');
const slash = value => value.split(path.sep).join('/');

function exclusion(relative, isDirectory = false) {
  if (privateTemplatePaths.some(prefix => relative === prefix || relative.startsWith(prefix + '/'))) return 'private-pro-template-and-viewer';
  const parts = relative.split('/');
  if (parts.some(part => skippedDirectories.test(part))) return 'dependencies-build-cache-or-tool-state';
  const basename = parts.at(-1);
  if (basename.startsWith('.env') && basename !== '.env.example') return 'environment-credentials';
  if (isDirectory && /^(?:uploads|recordings|transcripts|credentials|secrets|private-data)$/i.test(basename)) return 'personal-documents-data-or-archives';
  if (isDirectory) return null;
  if (/^(?:resume|cv|transcript|recording|passport|id[-_]?card|credentials?|secrets?|personal[-_]?profile)(?:[._-]|$)/i.test(basename)
    && /\.(?:json|txt|csv|png|jpe?g|webp)$/i.test(basename)) return 'personal-documents-data-or-archives';
  if (/\.(?:pem|key|p12|pfx|jks|keystore)$/i.test(basename) || /^(?:id_rsa|id_ed25519|\.npmrc|\.netrc|\.yarnrc.*)$/i.test(basename)) return 'credential-material';
  if (/\.(?:pdf|docx?|xlsx?|csv|tsv|mp3|wav|m4a|mp4|mov|zip|tar|gz|bak|sqlite3?|db)$/i.test(basename)) return 'personal-documents-data-or-archives';
  if (basename === 'compiled.css' || basename === 'next-env.d.ts' || /\.(?:tsbuildinfo|map|log)$/i.test(basename)) return 'generated-intermediate';
  if (!specialFiles.has(basename) && !sourceExtensions.has(path.extname(basename).toLowerCase())) return 'outside-source-file-types';
  return null;
}

function placeholder(value) {
  const clean = value.replace(/^['"]|['"]$/g, '').trim();
  return !clean || /^(?:\*+|(?:sk_test_|whsec_)\*+|(?:your[-_ ].*|replace[-_ ].*|example|placeholder|changeme))$/i.test(clean);
}

function validateExample(text) {
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const match = line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/);
    if (!match) return false;
    const [, key, raw] = match;
    const value = raw.replace(/^['"]|['"]$/g, '').trim();
    if (/^(?:POSTGRES|DATABASE)_URL$/.test(key)) {
      if (!placeholder(value) && value !== 'postgresql://***'
        && !/^postgres(?:ql)?:\/\/user:password@(?:localhost|127\.0\.0\.1)(?::\d+)?\/[A-Za-z0-9_-]+$/.test(value)) return false;
    } else if (/(?:^|_)(?:KEY|TOKEN|SECRET|PASSWORD)$/.test(key) && !placeholder(value)) return false;
    if (key === 'ADMIN_EMAILS' && value) return false;
    // Public product support/sender addresses are examples; private inboxes are
    // not an example value and must not be copied from a developer's machine.
    const addresses = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
    if (addresses.some(address => !/^(?:support|noreply)@reachard\.co$|@example\.(?:com|org|net)$/i.test(address))) return false;
  }
  return true;
}

function secretReason(text) {
  if (/-----BEGIN (?:RSA |EC |OPENSSH |DSA |ENCRYPTED )?PRIVATE KEY-----/.test(text)) return 'private-key-content';
  if (/\b(?:sk_(?:live|test)_[A-Za-z0-9]{24,}|whsec_[A-Za-z0-9]{24,}|sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{32,}|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|AKIA[0-9A-Z]{16})\b/.test(text)) return 'credential-shaped-content';
  const assignment = /\b(?:TREG_TOKEN|RESEND_API_KEY|OPENAI_API_KEY|HEROUI_KEY|AUTH_SECRET|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|RAPIDAPI_KEY|HUNTER_API_KEY|APOLLO_API_KEY|EXPLORIUM_API_KEY)\s*(?:=|:)\s*['"]([^'"\r\n]{12,})['"]/g;
  for (const match of text.matchAll(assignment)) {
    if (!placeholder(match[1]) && !/fixture|validation|example|test[-_ ]|\$\{|process\.env/i.test(match[1])) return 'literal-credential-assignment';
  }
  return null;
}

function octal(header, value, offset, width) {
  const number = value.toString(8);
  assert.ok(number.length < width, 'Archive field exceeds USTAR capacity.');
  header.write(number.padStart(width - 1, '0') + '\0', offset, width, 'ascii');
}

function tarHeader(name, size, mode) {
  assert.ok(name && !name.startsWith('/') && !name.split('/').includes('..') && !/[\r\n\0]/.test(name), 'Unsafe archive path.');
  let leaf = name, prefix = '';
  if (Buffer.byteLength(leaf) > 100) {
    const parts = name.split('/');
    leaf = parts.pop(); prefix = parts.join('/');
    assert.ok(Buffer.byteLength(leaf) <= 100 && Buffer.byteLength(prefix) <= 155, 'Path exceeds USTAR capacity.');
  }
  const header = Buffer.alloc(512);
  header.write(leaf, 0, 100, 'utf8');
  octal(header, mode, 100, 8); octal(header, 0, 108, 8); octal(header, 0, 116, 8);
  octal(header, size, 124, 12); octal(header, 0, 136, 12);
  header.fill(32, 148, 156); header.write('0', 156); header.write('ustar\0', 257); header.write('00', 263);
  header.write(prefix, 345, 155, 'utf8');
  const checksum = header.reduce((total, byte) => total + byte, 0);
  header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii');
  return header;
}

function makeTar(entries) {
  const chunks = [];
  for (const entry of entries) chunks.push(tarHeader(entry.path, entry.data.length, entry.mode), entry.data, Buffer.alloc((512 - entry.data.length % 512) % 512));
  chunks.push(Buffer.alloc(1024));
  return Buffer.concat(chunks);
}

// Read the generated archive back without extracting to disk. Every archived
// byte must match its inventory and every path must be unique and in scope.
function verifyArchive(compressed, entries) {
  const data = gunzipSync(compressed);
  const expected = new Map(entries.map(entry => [entry.path, entry]));
  for (let offset = 0; offset + 512 <= data.length;) {
    const header = data.subarray(offset, offset + 512);
    if (header.every(value => value === 0)) break;
    const field = (start, end) => header.subarray(start, end).toString('utf8').replace(/\0.*$/, '');
    const leaf = field(0, 100), prefix = field(345, 500), name = prefix ? `${prefix}/${leaf}` : leaf;
    const size = parseInt(field(124, 136), 8);
    const storedChecksum = parseInt(field(148, 156), 8);
    const checksum = header.reduce((sum, value, index) => sum + (index >= 148 && index < 156 ? 32 : value), 0);
    assert.equal(checksum, storedChecksum, 'Archive header checksum mismatch.');
    assert.ok(expected.has(name), 'Unexpected or duplicate archive path.');
    const entry = expected.get(name);
    assert.equal(size, entry.data.length);
    assert.equal(sha256(data.subarray(offset + 512, offset + 512 + size)), entry.sha256 || sha256(entry.data));
    expected.delete(name);
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  assert.equal(expected.size, 0, 'Archive is missing source files.');
}

function gitInfo() {
  const git = args => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true });
    assert.equal(result.status, 0, `Cannot read Git provenance: git ${args[0]}.`);
    return result.stdout;
  };
  const head = git(['rev-parse', 'HEAD']).trim();
  assert.match(head, /^[a-f0-9]{40,64}$/);
  const records = git(['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', ...scope]).split('\0');
  const changes = new Map();
  for (let index = 0; index < records.length; index++) {
    const record = records[index]; if (!record) continue;
    const status = record.slice(0, 2), name = record.slice(3);
    changes.set(name, status);
    if (/[RC]/.test(status)) index++;
  }
  return { head, changes };
}

async function collect() {
  const entries = [], omitted = new Map();
  let totalBytes = 0;
  const omit = reason => omitted.set(reason, (omitted.get(reason) || 0) + 1);
  async function visit(relative) {
    const absolute = path.resolve(root, relative);
    assert.ok(absolute.startsWith(path.resolve(root) + path.sep), 'Source escapes workspace.');
    const stat = await lstat(absolute);
    if (stat.isSymbolicLink()) { omit('symlinks-and-junctions'); return; }
    const reason = exclusion(relative, stat.isDirectory());
    if (reason) { omit(reason); return; }
    if (stat.isDirectory()) {
      for (const child of (await readdir(absolute)).sort()) await visit(`${relative}/${child}`);
      return;
    }
    if (!stat.isFile()) { omit('non-regular-files'); return; }
    assert.ok(stat.size <= 64 * 1024 * 1024, `Unexpectedly large source asset: ${relative}`);
    const data = await readFile(absolute);
    const textFile = !['.png', '.jpg', '.jpeg', '.webp', '.ico', '.woff', '.woff2', '.ttf', '.eot'].includes(path.extname(relative).toLowerCase());
    if (textFile) {
      const text = data.toString('utf8');
      if (path.basename(relative) === '.env.example' && !validateExample(text)) {
        throw new Error(`Example contains a non-placeholder configuration value: ${relative}. No archive was created.`);
      }
      const secret = secretReason(text);
      assert.ok(!secret, `Sensitive material detected (${secret}) in ${relative}. No archive was created.`);
    }
    totalBytes += data.length;
    assert.ok(totalBytes <= 256 * 1024 * 1024, 'Unexpected source archive size; inspect scope before proceeding.');
    entries.push({ path: relative, data, sha256: sha256(data), mode: relative.endsWith('.sh') ? 0o755 : 0o644 });
  }
  for (const relative of scope) await visit(relative);
  entries.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  return { entries, totalBytes, omitted: Object.fromEntries(omitted) };
}

async function main() {
  if (process.argv.includes('--self-test')) {
    assert.equal(exclusion('web/node_modules.interrupted/pkg/file.js'), 'dependencies-build-cache-or-tool-state');
    assert.equal(exclusion('web/.env.production'), 'environment-credentials');
    assert.equal(exclusion('web/components/heroui-dashboard-template/data/employees.ts'), 'private-pro-template-and-viewer');
    assert.equal(exclusion('web/uploads/resume.docx'), 'personal-documents-data-or-archives');
    assert.equal(exclusion('web/public/personal-profile.json'), 'personal-documents-data-or-archives');
    assert.equal(exclusion('web/lib/auth/password-reset.ts'), null);
    assert.ok(validateExample('AUTH_SECRET=***\nADMIN_EMAILS=\nEMAIL_FROM="Reachard <noreply@reachard.co>"'));
    assert.ok(!validateExample('AUTH_SECRET=actual-value\n'));
    assert.ok(!validateExample('ADMIN_EMAILS=private@example.com\n'));
    assert.equal(secretReason('AUTH_SECRET="isolated-fixture-secret"'), null);
    assert.equal(secretReason(['AUTH_SECRET', '="non-placeholder-material"'].join('')), 'literal-credential-assignment');
    const entries = [{ path: 'web/app/example.ts', data: Buffer.from('source\n'), mode: 0o644 }];
    const compressed = gzipSync(makeTar(entries));
    verifyArchive(compressed, entries);
    assert.throws(() => verifyArchive(compressed, []));
    assert.throws(() => tarHeader('../escape', 0, 0o644));
    console.log('Launch source packager self-test passed (built-in Node APIs only).');
    return;
  }
  const { entries, totalBytes, omitted } = await collect();
  const origin = gitInfo();
  const inventoryHash = sha256(entries.map(entry => `${entry.sha256}  ${entry.path}\n`).join(''));
  if (process.argv.includes('--check')) {
    console.log(JSON.stringify({ mode: 'check-only-no-archive-created', files: entries.length, bytes: totalBytes, inventorySha256: inventoryHash, omitted }, null, 2));
    return;
  }
  const compressed = gzipSync(makeTar(entries), { level: 9 });
  verifyArchive(compressed, entries);
  // A build or another agent may write during collection. Refuse to label a
  // moving checkout as a consistent snapshot rather than silently mixing it.
  const rechecked = await collect();
  const recheckedHash = sha256(rechecked.entries.map(entry => `${entry.sha256}  ${entry.path}\n`).join(''));
  assert.equal(recheckedHash, inventoryHash, 'Source files changed, appeared or disappeared during packaging. Re-run after writes finish.');
  assert.equal(gitInfo().head, origin.head, 'Git HEAD changed during packaging. Re-run after writes finish.');
  const createdAt = new Date().toISOString();
  const stamp = createdAt.replace(/[-:.]/g, '');
  const destination = path.join(outputRoot, `${stamp}-${inventoryHash.slice(0, 12)}`);
  await mkdir(outputRoot, { recursive: true });
  await mkdir(destination); // Never overwrite an earlier recoverable candidate.
  const archiveName = 'reachard-source-integration-candidate.tar.gz';
  const manifest = {
    formatVersion: 1, createdAt, classification: 'private-local-only-integration-candidate',
    sourceState: 'Current mixed working checkout: tracked, modified and untracked source. Not a Git commit, deployed release or Chrome Web Store submission.',
    git: { head: origin.head, scopedWorkingTreeDirty: origin.changes.size > 0,
      deletedTrackedPaths: [...origin.changes].filter(([name, status]) => status.includes('D') && !exclusion(name)).map(([name]) => name).sort() },
    access: 'Private local recovery copy. Contains existing application administrator-default configuration; do not publish as a public download. Confirm ADMIN_EMAILS before an authorized deployment; access behavior was not changed.',
    scope, exclusions: { summaryCounts: omitted, privateTemplatePaths,
      notes: ['Environment credentials, dependencies, downloaded Pro library originals, build caches, tool state and standalone personal/data documents are omitted.', 'The optional local private-template comparison viewer is intentionally omitted. Product UI remains intact.', 'The compiled extension/ui.js is the active extension runtime and is retained; its intermediate compiled.css is regenerated during builds.'] },
    dependencies: 'Install dependencies from the lockfiles. HeroUI Pro uses the existing CollectUI hpsetup channel with HEROUI_KEY supplied externally, as documented in web/docs/cloud-build.md.',
    archive: { file: archiveName, bytes: compressed.length, sha256: sha256(compressed) },
    sourceFileCount: entries.length, sourceBytes: totalBytes, inventorySha256: inventoryHash,
    files: entries.map(entry => ({ path: entry.path, bytes: entry.data.length, sha256: entry.sha256, mode: entry.mode.toString(8), gitStatus: origin.changes.get(entry.path) || 'clean-tracked' })),
  };
  const fileList = entries.map(entry => `${entry.sha256}  ${entry.path}\n`).join('');
  const manifestText = JSON.stringify(manifest, null, 2) + '\n';
  const restoreText = `# Private source integration candidate\n\nThis is a recoverable copy of the current mixed working checkout, not a Git commit, production release, or store submission. Keep this directory private. Existing administrator-default configuration is part of the application source; confirm ADMIN_EMAILS before any authorized deployment. No credentials or standalone personal documents are included.\n\nVerify SHA256SUMS before use. Extract the archive into a new, empty directory; do not overlay a checkout or delete current work. Verify extracted files against source-files.sha256. The file list and release-manifest.json record the source SHA-256 hashes and original Git HEAD/status. Source timestamps are normalized in the archive; shell scripts retain executable mode.\n\nInstall dependencies using the frozen project lockfiles and the documented CollectUI hpsetup channel. Supply secrets separately through the normal environment/secret manager. The optional local private-template comparison viewer is omitted. No deployment, migration, payment, provider lookup, email delivery, or Chrome Web Store submission is performed by this snapshot.\n\nRebuild a later candidate with: node scripts/prepare-launch-source.mjs\nCheck scope without creating an archive: node scripts/prepare-launch-source.mjs --check\nRun the packager's isolated self-check: node scripts/prepare-launch-source.mjs --self-test\n`;
  const outputs = new Map([[archiveName, compressed], ['release-manifest.json', manifestText], ['source-files.sha256', fileList], ['RESTORE.md', restoreText]]);
  for (const [name, data] of outputs) await writeFile(path.join(destination, name), data);
  await writeFile(path.join(destination, 'SHA256SUMS'), [...outputs].map(([name, data]) => `${sha256(data)}  ${name}\n`).join(''));
  console.log(JSON.stringify({ classification: manifest.classification, directory: slash(path.relative(root, destination)), archive: archiveName, sha256: manifest.archive.sha256, sourceFiles: entries.length, sourceBytes: totalBytes, compressedBytes: compressed.length, gitHead: origin.head }, null, 2));
}

await main();
