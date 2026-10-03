import assert from 'node:assert/strict';
import { before, beforeEach, after, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const pg = new PGlite();
const db = drizzle(pg);
const cache = new Map();
let currentUser, readBarrier;
const events = [];
const overrides = {
  '@/lib/db/drizzle': { db },
  '@/lib/db/queries': {
    getUser: async () => currentUser,
    getSettings: async id => {
      const [settings] = await db.select().from(schema.userSettings).where(eq(schema.userSettings.userId, id));
      // Force both HTTP requests to read the same snapshot before either saves.
      if (readBarrier) await readBarrier();
      return settings || null;
    },
  },
  '@/lib/product-events': { recordProductEvent: async (...args) => { events.push(args); } },
};
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const output = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  const localRequire = name => {
    if (Object.hasOwn(overrides, name)) return overrides[name];
    if (name.endsWith('.json')) return require(resolve(dirname(file), name));
    if (name.startsWith('@/')) return load(resolve(root, name.slice(2) + '.ts'));
    if (name.startsWith('.')) return load(resolve(dirname(file), name + '.ts'));
    return require(name);
  };
  new Function('require', 'module', 'exports', output)(localRequire, module, module.exports);
  return module.exports;
}
const schema = load(resolve(root, 'lib/db/schema.ts'));
const { POST } = load(resolve(root, 'app/api/settings/route.ts'));
const save = payload => POST(new Request('http://localhost/api/settings', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
}));
const settingsRow = async () => (await db.select().from(schema.userSettings).where(eq(schema.userSettings.userId, 1)))[0];
function synchronizeReads() {
  let count = 0, release;
  const gate = new Promise(resolve => { release = resolve; });
  readBarrier = async () => { if (++count === 2) release(); await gate; };
}
before(async () => {
  const journal = JSON.parse(readFileSync(resolve(root, 'lib/db/migrations/meta/_journal.json'), 'utf8'));
  for (const entry of journal.entries) await pg.exec(readFileSync(resolve(root, `lib/db/migrations/${entry.tag}.sql`), 'utf8'));
});
beforeEach(async () => {
  readBarrier = null; events.length = 0;
  await pg.exec('TRUNCATE users RESTART IDENTITY CASCADE');
  [currentUser] = await db.insert(schema.users).values({ name: 'Fixture', email: 'fixture@example.com', passwordHash: 'fixture', emailVerifiedAt: new Date() }).returning();
});
after(async () => { await pg.close(); });

test('concurrent partial saves preserve both changes on an existing profile', async () => {
  await save({ senderName: 'Original', emailSignature: 'Original signature', resumeContext: 'Keep this resume' });
  synchronizeReads();
  const responses = await Promise.all([save({ senderName: 'Updated name' }), save({ emailSignature: 'Updated signature' })]);
  assert.deepEqual(responses.map(response => response.status), [200, 200]);
  const row = await settingsRow();
  assert.equal(row.senderName, 'Updated name');
  assert.equal(row.emailSignature, 'Updated signature');
  assert.equal(row.resumeContext, 'Keep this resume');
});

test('simultaneous first saves merge independent fields into one profile', async () => {
  synchronizeReads();
  const responses = await Promise.all([save({ school: 'Example University' }), save({ senderProfile: 'Research student' })]);
  assert.deepEqual(responses.map(response => response.status), [200, 200]);
  const row = await settingsRow();
  assert.equal(row.school, 'Example University');
  assert.equal(row.senderProfile, 'Research student');
  assert.equal(row.emailTone, 'warm');
  assert.equal((await pg.query('SELECT count(*)::int AS count FROM user_settings')).rows[0].count, 1);
  assert.ok(events.some(([, event]) => event === 'onboarding.completed'));
});

test('explicit clearing remains supported and omitted fields stay intact', async () => {
  await save({ senderName: 'Keep me', resumeContext: 'Resume', resumeFileName: 'resume.pdf', resumeUploadedAt: '2026-09-01T00:00:00.000Z', emailTone: 'formal' });
  assert.equal((await save({ resumeContext: '', resumeFileName: '', resumeUploadedAt: null })).status, 200);
  const row = await settingsRow();
  assert.equal(row.resumeContext, '');
  assert.equal(row.resumeFileName, '');
  assert.equal(row.resumeUploadedAt, null);
  assert.equal(row.senderName, 'Keep me');
  assert.equal(row.emailTone, 'formal');
});

test('invalid and signed-out requests cannot mutate a profile', async () => {
  await save({ senderName: 'Keep me' });
  assert.equal((await save({ emailTone: 'invalid' })).status, 400);
  currentUser = null;
  assert.equal((await save({ senderName: 'Overwrite' })).status, 401);
  assert.equal((await settingsRow()).senderName, 'Keep me');
});
