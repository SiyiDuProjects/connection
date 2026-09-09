import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import ts from 'typescript';
import * as jose from 'jose';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { NextRequest } from 'next/server.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const pg = new PGlite();
const db = drizzle(pg);
const modules = new Map();
const jar = new Map();
const background = [];
const sent = [];
const savedEnv = { ...process.env };
const originalFetch = globalThis.fetch;
let failDelivery = false;
let number = 0;
process.env.AUTH_SECRET = 'isolated-password-reset-fixture-secret-at-least-32-characters';
const overrides = {
  'server-only': {}, jose,
  '@/lib/db/drizzle': { db }, './drizzle': { db },
  'next/server': { after: callback => background.push(callback) },
  'next/headers': { cookies: async () => ({
    get: name => jar.has(name) ? { value: jar.get(name) } : undefined,
    set: (name, value) => jar.set(name, value),
    delete: name => jar.delete(name),
  }) },
};
function load(file) {
  if (modules.has(file)) return modules.get(file).exports;
  const module = { exports: {} }; modules.set(file, module);
  const source = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
  } }).outputText;
  const localRequire = specifier => {
    if (Object.hasOwn(overrides, specifier)) return overrides[specifier];
    if (specifier.startsWith('@/')) return load(resolve(root, `${specifier.slice(2)}.ts`));
    if (specifier.startsWith('.')) return load(resolve(dirname(file), `${specifier}.ts`));
    return require(specifier);
  };
  new Function('require', 'module', 'exports', source)(localRequire, module, module.exports);
  return module.exports;
}
const service = load(resolve(root, 'lib/auth/password-reset.ts'));
const actions = load(resolve(root, 'app/(login)/password-reset-actions.ts'));
const session = load(resolve(root, 'lib/auth/session.ts'));
const queries = load(resolve(root, 'lib/db/queries.ts'));
const tokens = load(resolve(root, 'lib/extension-tokens.ts'));
const crypto = load(resolve(root, 'lib/auth/password-reset-token.ts'));
const mailer = load(resolve(root, 'lib/email/resend.ts'));
const rows = async (sql, values = []) => (await pg.query(sql, values)).rows;
const form = data => { const result = new FormData(); for (const [key, value] of Object.entries(data)) result.set(key, value); return result; };
const takeToken = () => new URL(sent.at(-1).body.text.match(/https?:\/\/[^\s]+/)[0]).searchParams.get('token');
const drain = async () => { while (background.length) await background.shift()(); };
async function user({ verified = true, deleted = false } = {}) {
  const [result] = await rows(`INSERT INTO users (email,password_hash,email_verified_at,deleted_at)
    VALUES ($1,$2,$3,$4) RETURNING *`, [`recovery-${++number}@example.com`, await session.hashPassword('original-password'), verified ? new Date() : null, deleted ? new Date() : null]);
  return result;
}
const age = userId => pg.query("UPDATE password_reset_tokens SET created_at=now()-interval '61 seconds' WHERE user_id=$1", [userId]);

before(async () => {
  await pg.exec(`SET TIME ZONE 'UTC';
    CREATE TABLE users (id serial PRIMARY KEY, name varchar(100), email varchar(255) NOT NULL UNIQUE, email_verified_at timestamp,
      password_hash text NOT NULL, role varchar(20) NOT NULL DEFAULT 'member', created_at timestamp NOT NULL DEFAULT now(),
      updated_at timestamp NOT NULL DEFAULT now(), deleted_at timestamp);
    CREATE TABLE extension_api_tokens (id serial PRIMARY KEY, user_id integer NOT NULL REFERENCES users(id), token_hash text UNIQUE, name text DEFAULT 'Chrome extension',
      created_at timestamp DEFAULT now(), last_used_at timestamp, revoked_at timestamp);
    CREATE TABLE email_verification_tokens (id serial PRIMARY KEY, user_id integer, token_hash text, code_hash text, attempts integer DEFAULT 0,
      expires_at timestamp, created_at timestamp DEFAULT now(), used_at timestamp);
    CREATE TABLE user_settings (id serial PRIMARY KEY, user_id integer);
    CREATE TABLE api_idempotency_keys (id serial PRIMARY KEY, user_id integer);
    CREATE TABLE team_members (id serial PRIMARY KEY, user_id integer);
    CREATE TABLE activity_logs (id serial PRIMARY KEY, team_id integer, user_id integer, action text, ip_address text, timestamp timestamp DEFAULT now());`);
  await pg.exec(readFileSync(resolve(root, 'lib/db/migrations/0015_password_recovery.sql'), 'utf8'));
});
beforeEach(() => {
  background.length = 0; sent.length = 0; jar.clear(); failDelivery = false;
  process.env.RESEND_API_KEY = 'fixture-key';
  process.env.EMAIL_FROM = 'Old Display <noreply@example.com>';
  process.env.BASE_URL = 'https://reachard.co';
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    sent.push({ headers: options.headers, body: JSON.parse(options.body) });
    return failDelivery ? new Response('{}', { status: 503 }) : Response.json({ id: 'fixture-delivery' });
  };
});
after(async () => {
  globalThis.fetch = originalFetch;
  for (const key of ['AUTH_SECRET', 'RESEND_API_KEY', 'EMAIL_FROM', 'BASE_URL', 'NODE_ENV']) {
    if (savedEnv[key] === undefined) delete process.env[key]; else process.env[key] = savedEnv[key];
  }
  await pg.close();
});

test('public responses are identical and return before any account lookup or email delivery', async () => {
  const existing = await user(), deleted = await user({ deleted: true });
  const replies = [];
  for (const email of [existing.email, 'unknown@example.com', deleted.email]) {
    replies.push(await actions.requestPasswordReset({}, form({ email })));
    assert.equal(sent.length, 0);
  }
  assert.deepEqual(replies[0], replies[1]); assert.deepEqual(replies[1], replies[2]);
  assert.equal((await rows('SELECT * FROM password_reset_tokens')).length, 0);
  await drain();
  assert.equal(sent.length, 1); assert.equal(sent[0].body.to[0], existing.email);
  assert.match(sent[0].body.from, /^"Reachard" <noreply@example.com>$/);
  assert.ok(sent[0].body.html.includes('https://reachard.co/images/brand/reachard-logo-mark.png'));
});

test('reset token is random, purpose-separated, hashed, bounded to 30 minutes and single use', async () => {
  const u = await user();
  await service.issuePasswordReset(`  ${u.email.toUpperCase()} `);
  const token = takeToken();
  assert.match(token, /^[A-Za-z0-9_-]{43}$/);
  const [record] = await rows('SELECT * FROM password_reset_tokens WHERE user_id=$1', [u.id]);
  assert.equal(record.token_hash, createHash('sha256').update(`password-reset:${token}`).digest('hex'));
  assert.notEqual(record.token_hash, token);
  assert.equal(new Date(record.expires_at) - new Date(record.created_at), 30 * 60 * 1000);
  assert.match(sent[0].headers['Idempotency-Key'], /^password-reset\/[a-f0-9]{64}$/);
  await rows('INSERT INTO extension_api_tokens(user_id,token_hash) VALUES ($1,$2)', [u.id, 'fixture-extension']);
  assert.ok(await service.resetPassword(token, 'new-private-password'));
  assert.equal(await service.resetPassword(token, 'second-new-password'), null);
  const [updated] = await rows('SELECT * FROM users WHERE id=$1', [u.id]);
  assert.equal(updated.session_version, 1);
  assert.ok(await session.comparePasswords('new-private-password', updated.password_hash));
  assert.ok(!await session.comparePasswords('original-password', updated.password_hash));
  assert.ok((await rows('SELECT revoked_at FROM extension_api_tokens WHERE user_id=$1', [u.id]))[0].revoked_at);
});

test('concurrent consumption changes the password exactly once', async () => {
  const u = await user(); await service.issuePasswordReset(u.email); const token = takeToken();
  const results = await Promise.all([service.resetPassword(token, 'parallel-password-one'), service.resetPassword(token, 'parallel-password-two')]);
  assert.equal(results.filter(Boolean).length, 1);
  assert.equal((await rows('SELECT session_version FROM users WHERE id=$1', [u.id]))[0].session_version, 1);
});

test('expired, malformed, wrong-purpose and superseded tokens cannot change credentials', async () => {
  const u = await user(); await service.issuePasswordReset(u.email); const first = takeToken();
  await age(u.id); await service.issuePasswordReset(u.email); const second = takeToken();
  assert.notEqual(first, second);
  assert.equal(await service.resetPassword(first, 'must-not-be-saved'), null);
  await rows("UPDATE password_reset_tokens SET expires_at=now()-interval '1 second' WHERE user_id=$1", [u.id]);
  for (const token of [second, 'invalid', '123456', crypto.newPasswordResetToken()]) assert.equal(await service.resetPassword(token, 'must-not-be-saved'), null);
  const verification = crypto.newPasswordResetToken();
  await rows('INSERT INTO email_verification_tokens(user_id,token_hash,expires_at) VALUES ($1,$2,now()+interval \'10 minutes\')', [u.id, createHash('sha256').update(verification).digest('hex')]);
  assert.equal(await service.resetPassword(verification, 'must-not-be-saved'), null);
  assert.equal((await rows('SELECT session_version FROM users WHERE id=$1', [u.id]))[0].session_version, 0);
});

test('per-account cooldown, hourly cap and concurrent issuance stop email flooding', async () => {
  const u = await user();
  await Promise.all([service.issuePasswordReset(u.email), service.issuePasswordReset(u.email)]);
  assert.equal(sent.length, 1);
  await service.issuePasswordReset(u.email); assert.equal(sent.length, 1);
  for (let i = 0; i < 4; i++) { await age(u.id); await service.issuePasswordReset(u.email); }
  assert.equal(sent.length, 5);
  await age(u.id); await service.issuePasswordReset(u.email); assert.equal(sent.length, 5);
  const response = await actions.requestPasswordReset({}, form({ email: u.email }));
  const missing = await actions.requestPasswordReset({}, form({ email: 'missing-cap@example.com' }));
  assert.deepEqual(response, missing); await drain(); assert.equal(sent.length, 5);
});

test('delivery failures invalidate issued links and preserve existing credentials', async () => {
  const u = await user(); failDelivery = true;
  await assert.rejects(service.issuePasswordReset(u.email), /delivery failed/);
  const token = takeToken();
  assert.ok((await rows('SELECT used_at FROM password_reset_tokens WHERE user_id=$1', [u.id]))[0].used_at);
  assert.equal(await service.resetPassword(token, 'must-not-be-saved'), null);
  assert.equal((await rows('SELECT session_version FROM users WHERE id=$1', [u.id]))[0].session_version, 0);
});

test('successful action clears the browser session, requires normal sign-in, and mails a password-free notification', async () => {
  const u = await user(); await service.issuePasswordReset(u.email); const token = takeToken();
  jar.set('session', 'old-cookie');
  const data = form({ token, password: 'never-email-this-password', confirmPassword: 'never-email-this-password' });
  const result = await actions.confirmPasswordReset({}, data);
  assert.ok(result.success); assert.equal(jar.has('session'), false);
  assert.equal(sent.length, 1); await drain(); assert.equal(sent.length, 2);
  assert.match(sent[1].headers['Idempotency-Key'], /^password-changed\//);
  assert.ok(!JSON.stringify(sent[1]).includes('never-email-this-password'));
  assert.equal((await actions.confirmPasswordReset({}, data)).invalidLink, true);
});

test('reset revokes old and legacy web sessions even when middleware refreshes their expiry', async () => {
  const u = await user();
  await session.setSession({ id: u.id, sessionVersion: 0 });
  const old = jar.get('session');
  assert.equal((await queries.getUser()).id, u.id);
  await service.issuePasswordReset(u.email); await service.resetPassword(takeToken(), 'new-session-password');
  assert.equal(await queries.getUser(), null);
  // Middleware renews expiry only and preserves the original version.
  const nativeNext = require('next/server.js');
  const earlierOverride = overrides['next/server']; overrides['next/server'] = nativeNext;
  const middleware = load(resolve(root, 'middleware.ts')).middleware;
  overrides['next/server'] = earlierOverride;
  const response = await middleware(new NextRequest('https://reachard.co/', { headers: { cookie: `session=${old}` } }));
  const refreshed = response.cookies.get('session').value;
  assert.equal((await session.verifyToken(refreshed)).user.sessionVersion, 0);
  jar.set('session', refreshed); assert.equal(await queries.getUser(), null);
  jar.set('session', await session.signToken({ user: { id: u.id }, expires: new Date(Date.now() + 10000).toISOString() }));
  assert.equal(await queries.getUser(), null);
  await session.setSession({ id: u.id, sessionVersion: 1 }); assert.equal((await queries.getUser()).id, u.id);
  await rows('UPDATE users SET updated_at=now(),name=$1 WHERE id=$2', ['New name', u.id]);
  assert.equal((await queries.getUser()).id, u.id, 'profile updates do not invalidate a new session');
});

test('stale web authentication cannot mint a new extension token after reset', async () => {
  const u = await user();
  assert.ok(await tokens.createExtensionToken(u.id, 0));
  await service.issuePasswordReset(u.email); await service.resetPassword(takeToken(), 'recovered-password');
  assert.equal(await tokens.createExtensionToken(u.id, 0), null);
  assert.ok(await tokens.createExtensionToken(u.id, 1));
});

test('email change, deleted account and authenticated password change invalidate pending links', async () => {
  for (const reason of ['email', 'delete', 'password']) {
    const u = await user(); await service.issuePasswordReset(u.email); const token = takeToken();
    if (reason === 'email') await rows('UPDATE users SET email=$1 WHERE id=$2', ['moved-' + u.email, u.id]);
    if (reason === 'delete') await rows('UPDATE users SET deleted_at=now() WHERE id=$1', [u.id]);
    if (reason === 'password') {
      const updated = await service.changeAuthenticatedPassword(u.id, u.password_hash, await session.hashPassword('normal-changed-password'), 0);
      assert.equal(updated.sessionVersion, 1);
      assert.equal(await service.changeAuthenticatedPassword(u.id, u.password_hash, 'stale-write', 0), null);
    }
    assert.equal(await service.resetPassword(token, 'must-not-be-saved'), null);
  }
});

test('resetting an unverified account does not implicitly verify email', async () => {
  const u = await user({ verified: false }); await service.issuePasswordReset(u.email);
  assert.ok(await service.resetPassword(takeToken(), 'new-unverified-password'));
  assert.equal((await rows('SELECT email_verified_at FROM users WHERE id=$1', [u.id]))[0].email_verified_at, null);
});

test('new passwords are bounded by UTF-8 bytes and invalid input leaves the token usable', async () => {
  const u = await user(); await service.issuePasswordReset(u.email); const token = takeToken();
  for (const password of ['short', 'a'.repeat(73), '🙂'.repeat(19), '密'.repeat(25)]) {
    assert.equal(await service.resetPassword(token, password), null);
    const result = await actions.confirmPasswordReset({}, form({ token, password, confirmPassword: password }));
    assert.ok(result.error);
  }
  const exactLimit = '密'.repeat(24);
  assert.equal(Buffer.byteLength(exactLimit, 'utf8'), 72);
  assert.ok(await service.resetPassword(token, exactLimit));
  const [updated] = await rows('SELECT password_hash FROM users WHERE id=$1', [u.id]);
  assert.ok(await session.comparePasswords(exactLimit, updated.password_hash));
});

test('storage failure rolls back token consumption, password changes and extension revocation together', async () => {
  const u = await user(); await service.issuePasswordReset(u.email); const token = takeToken();
  await rows('INSERT INTO extension_api_tokens(user_id,token_hash) VALUES ($1,$2)', [u.id, 'atomic-extension']);
  await pg.exec(`ALTER TABLE users ADD CONSTRAINT block_reset_fixture CHECK (id <> ${u.id} OR session_version = 0)`);
  try { await assert.rejects(service.resetPassword(token, 'atomic-new-password')); }
  finally { await pg.exec('ALTER TABLE users DROP CONSTRAINT block_reset_fixture'); }
  const [record] = await rows('SELECT used_at FROM password_reset_tokens WHERE user_id=$1', [u.id]);
  assert.equal(record.used_at, null);
  assert.equal((await rows('SELECT revoked_at FROM extension_api_tokens WHERE user_id=$1', [u.id]))[0].revoked_at, null);
  assert.ok(await service.resetPassword(token, 'atomic-new-password'));
});

test('URL origin and sender validation reject attacker domains and header injection', () => {
  const token = crypto.newPasswordResetToken();
  process.env.NODE_ENV = 'production';
  for (const base of ['https://evil.example', 'http://reachard.co', 'https://reachard.co@evil.example', 'https://reachard.co?next=evil']) {
    process.env.BASE_URL = base; assert.throws(() => crypto.passwordResetUrl(token));
  }
  process.env.BASE_URL = 'https://reachard.co/untrusted-path';
  assert.equal(new URL(crypto.passwordResetUrl(token)).pathname, '/reset-password');
  process.env.EMAIL_FROM = 'Reachard\r\nBcc: attacker@example.com <noreply@example.com>';
  assert.throws(mailer.accountEmailSender);
});
