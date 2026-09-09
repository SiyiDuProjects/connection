const assert = require('node:assert/strict');
const { test, before, beforeEach, after } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const root = process.env.REACHARD_AUDIT_WEB || path.resolve(__dirname, '..');
const projectRequire = createRequire(path.join(root, 'package.json'));
const ts = projectRequire('typescript');
const { PGlite } = projectRequire('@electric-sql/pglite');
const { drizzle } = projectRequire('drizzle-orm/pglite');
const { eq } = projectRequire('drizzle-orm');
const pg = new PGlite();
const db = drizzle(pg);
const modules = new Map();
let user = { id: 1 }, token = { id: 42 }, team, records, portalCalls, portalFails;
let schema;
const overrides = {
  'server-only': {},
  '@/lib/db/drizzle': { db },
  '@/lib/db/queries': {
    getUser: async () => user,
    getTeamForUser: async () => team,
    getActiveExtensionTokenInfo: async () => token,
    getSettings: async id => (await db.select().from(schema.userSettings).where(eq(schema.userSettings.userId, id)))[0] || null,
  },
  '@/lib/extension-tokens': { getUserFromExtensionBearer: async () => null },
  '@/lib/product-events': { recordProductEvent: async (...args) => records.push(args) },
  '@/lib/payments/stripe': { createCustomerPortalSession: async current => {
    portalCalls.push(current.id);
    if (portalFails) throw new Error('provider-secret-must-not-leak');
    return { url: 'https://billing.stripe.com/fixture' };
  } },
  'next/navigation': { redirect: url => { const error = new Error('redirect'); error.url = url; throw error; } },
};
function load(file) {
  if (modules.has(file)) return modules.get(file).exports;
  const mod = { exports: {} }; modules.set(file, mod);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const localRequire = spec => {
    if (Object.hasOwn(overrides, spec)) return overrides[spec];
    if (spec.startsWith('@/')) return load(path.join(root, spec.slice(2) + '.ts'));
    if (spec.startsWith('.')) return load(path.resolve(path.dirname(file), spec + '.ts'));
    return projectRequire(spec);
  };
  new Function('require', 'module', 'exports', source)(localRequire, mod, mod.exports);
  return mod.exports;
}
schema = load(path.join(root, 'lib/db/schema.ts'));
const events = load(path.join(root, 'app/api/events/route.ts'));
const custom = load(path.join(root, 'app/api/settings/custom/route.ts'));
const billing = load(path.join(root, 'app/(dashboard)/dashboard/billing/actions.ts'));
const school = load(path.join(root, 'app/api/metadata/schools/route.ts'));
const req = (data, method = 'POST') => new Request('https://reachard.co/api/fixture', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
const originalFetch = global.fetch;
const oldRapidKey = process.env.RAPIDAPI_KEY;
before(async () => {
  await pg.exec(`CREATE TABLE user_settings (
    id serial PRIMARY KEY, user_id integer NOT NULL UNIQUE, sender_name text, region text, school text, email_signature text,
    intro_style varchar(40) NOT NULL DEFAULT 'student', target_role text, email_tone varchar(40) NOT NULL DEFAULT 'warm',
    outreach_length varchar(40) NOT NULL DEFAULT 'concise', outreach_goal varchar(40) NOT NULL DEFAULT 'advice', outreach_style_notes text,
    default_search_preferences jsonb NOT NULL DEFAULT '{}', sender_profile text, resume_context text, resume_file_name text,
    resume_uploaded_at timestamp, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
  );`);
});
beforeEach(async () => {
  await pg.exec('TRUNCATE user_settings RESTART IDENTITY');
  user = { id: 1 }; token = { id: 42 }; records = []; portalCalls = []; portalFails = false;
  team = { id: 2, stripeCustomerId: 'cus_fixture', teamMembers: [{ userId: 1, role: 'owner' }] };
});
after(async () => { global.fetch = originalFetch; if (oldRapidKey === undefined) delete process.env.RAPIDAPI_KEY; else process.env.RAPIDAPI_KEY = oldRapidKey; await pg.close(); });

test('clients cannot forge payment or onboarding funnel events', async () => {
  for (const event of ['subscription.started', 'subscription.paid', 'subscription.renewed', 'checkout.started', 'onboarding.completed']) {
    assert.equal((await events.POST(req({ event }))).status, 400);
  }
  assert.equal(records.length, 0);
  assert.equal((await events.POST(req({ event: 'extension.connected', metadata: { secret: 'ignored' } }))).status, 400);
});
test('extension event requires an authenticated user and an issued token', async () => {
  token = null; assert.equal((await events.POST(req({ event: 'extension.connected' }))).status, 409);
  token = { id: 42 }; assert.equal((await events.POST(req({ event: 'extension.connected' }))).status, 200);
  assert.deepEqual(records[0], [1, 'extension.connected', { tokenId: 42, source: 'client-confirmed' }]);
  user = null; assert.equal((await events.POST(req({ event: 'extension.connected' }))).status, 401);
});
test('partial preference save preserves omitted choices, profile and resume', async () => {
  await db.insert(schema.userSettings).values({ userId: 1, emailTone: 'formal', outreachGoal: 'referral', outreachStyleNotes: 'Keep this note', resumeContext: 'Private resume fixture' });
  const response = await custom.PATCH(req({ length: 'short' }, 'PATCH'));
  assert.equal(response.status, 200);
  assert.deepEqual((await response.json()).custom, { tone: 'formal', length: 'short', goal: 'referral', notes: 'Keep this note' });
  assert.equal((await overrides['@/lib/db/queries'].getSettings(1)).resumeContext, 'Private resume fixture');
});
test('simultaneous first preference saves create one row without discarding fields', async () => {
  const results = await Promise.all([custom.PATCH(req({ tone: 'direct' }, 'PATCH')), custom.PATCH(req({ notes: 'New note' }, 'PATCH'))]);
  assert.deepEqual(results.map(r => r.status), [200, 200]);
  const rows = await db.select().from(schema.userSettings);
  assert.equal(rows.length, 1); assert.equal(rows[0].emailTone, 'concise'); assert.equal(rows[0].outreachStyleNotes, 'New note');
});
test('empty preference save is a no-op and invalid values are rejected', async () => {
  assert.equal((await custom.PATCH(req({}, 'PATCH'))).status, 200);
  assert.equal((await db.select().from(schema.userSettings)).length, 0);
  assert.equal((await custom.PATCH(req({ tone: 'made-up' }, 'PATCH'))).status, 400);
});
test('billing entry enforces owner access before calling Stripe', async () => {
  user = null;
  await assert.rejects(billing.openBillingPortal({}, new FormData()), e => e.url.includes('/sign-in'));
  user = { id: 8 };
  assert.match((await billing.openBillingPortal({}, new FormData())).error, /owner/);
  user = { id: 1 }; team.stripeCustomerId = null;
  assert.match((await billing.openBillingPortal({}, new FormData())).error, /no billing account/);
  assert.equal(portalCalls.length, 0);
});
test('billing redirects to the existing portal and exposes a safe retry on provider failure', async () => {
  await assert.rejects(billing.openBillingPortal({}, new FormData()), e => e.url === 'https://billing.stripe.com/fixture');
  portalFails = true;
  const result = await billing.openBillingPortal({}, new FormData());
  assert.match(result.error, /temporarily unavailable/); assert.doesNotMatch(result.error, /provider-secret/);
});
test('retired metadata lookups never spend provider credits and preserve manual entry', async () => {
  process.env.RAPIDAPI_KEY = 'fixture-only'; let calls = 0;
  global.fetch = async (_url, options) => { calls++; assert.ok(options.signal); throw new Error('provider-secret'); };
  const failed = await school.GET(new Request('https://reachard.co/api/metadata/schools?q=Berkeley'));
  assert.equal(failed.status, 410); assert.match((await failed.json()).error, /Enter the name yourself/);
  const invalid = await school.GET(new Request('https://reachard.co/api/metadata/schools?q=' + 'a'.repeat(161)));
  assert.equal(invalid.status, 400); assert.equal(calls, 0);
});


test('account deletion is atomic, retryable and isolated from another user', async () => {
  const deletion = load(path.join(root, 'lib/delete-account-data.ts'));
  await pg.exec(`
    CREATE TABLE users (id integer PRIMARY KEY, name varchar(100), email varchar(255) UNIQUE NOT NULL, email_verified_at timestamp, password_hash text NOT NULL, session_version integer NOT NULL DEFAULT 0, role varchar(20) DEFAULT 'member', created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now(), deleted_at timestamp);
    CREATE TABLE extension_api_tokens (id serial PRIMARY KEY, user_id integer, revoked_at timestamp);
    CREATE TABLE email_verification_tokens (id serial PRIMARY KEY, user_id integer);
    CREATE TABLE password_reset_tokens (id serial PRIMARY KEY, user_id integer);
    CREATE TABLE api_idempotency_keys (id serial PRIMARY KEY, user_id integer);
    CREATE TABLE team_members (id serial PRIMARY KEY, user_id integer);
    CREATE TABLE activity_logs (id serial PRIMARY KEY, team_id integer, user_id integer, action text, ip_address text, timestamp timestamp DEFAULT now());
    INSERT INTO users (id,name,email,password_hash,email_verified_at) VALUES (1,'First','first@example.com','old-hash',now()),(2,'Other','other@example.com','other-hash',now());
    INSERT INTO extension_api_tokens (user_id) VALUES (1),(2);
    INSERT INTO email_verification_tokens (user_id) VALUES (1),(2);
    INSERT INTO api_idempotency_keys (user_id) VALUES (1),(2);
    INSERT INTO team_members (user_id) VALUES (1),(2);
    INSERT INTO user_settings (user_id,resume_context) VALUES (1,'resume-one'),(2,'resume-two');
    ALTER TABLE users ADD CONSTRAINT force_rollback CHECK (deleted_at IS NULL);
  `);
  const expected = { sessionVersion: 0, passwordHash: 'old-hash' };
  await assert.rejects(deletion.deleteAccountData(1, 7, expected));
  assert.equal((await pg.query('SELECT * FROM user_settings WHERE user_id=1')).rows.length, 1);
  assert.equal((await pg.query('SELECT revoked_at FROM extension_api_tokens WHERE user_id=1')).rows[0].revoked_at, null);
  assert.equal((await pg.query('SELECT * FROM activity_logs')).rows.length, 0);
  await pg.exec('ALTER TABLE users DROP CONSTRAINT force_rollback');
  await deletion.deleteAccountData(1, 7, expected);
  const deleted = (await pg.query('SELECT * FROM users WHERE id=1')).rows[0];
  assert.ok(deleted.deleted_at); assert.equal(deleted.name, null); assert.equal(deleted.email_verified_at, null);
  assert.equal(deleted.password_hash, '!deleted-account'); assert.match(deleted.email, /^deleted-1-.+@deleted.invalid$/); assert.ok(deleted.email.length <= 255);
  for (const table of ['email_verification_tokens','api_idempotency_keys','team_members','user_settings']) {
    assert.equal((await pg.query(`SELECT * FROM ${table} WHERE user_id=1`)).rows.length, 0);
    assert.equal((await pg.query(`SELECT * FROM ${table} WHERE user_id=2`)).rows.length, 1);
  }
  assert.ok((await pg.query('SELECT revoked_at FROM extension_api_tokens WHERE user_id=1')).rows[0].revoked_at);
  assert.equal((await pg.query('SELECT revoked_at FROM extension_api_tokens WHERE user_id=2')).rows[0].revoked_at, null);
  await deletion.deleteAccountData(1, 7, expected);
  assert.equal((await pg.query('SELECT * FROM activity_logs')).rows.length, 1);
  assert.equal((await pg.query('SELECT email FROM users WHERE id=1')).rows[0].email, deleted.email);
});
