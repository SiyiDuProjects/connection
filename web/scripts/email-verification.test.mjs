import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash, randomBytes } from 'node:crypto';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';

// Compile the real server modules. Only environment boundaries are replaced:
// an in-memory PostgreSQL engine, Next cookies/navigation, and HTTP delivery.
const root = fileURLToPath(new URL('..', import.meta.url));
const require = createRequire(import.meta.url);
const pg = new PGlite();
const database = drizzle(pg);
const cache = new Map();
let sessions = [];
let currentUser = null;
const overrides = {
  '@/lib/auth/rate-limit': { checkCredentialRateLimit: async () => null, reserveAccountEmailDelivery: async () => {} },
  'server-only': {},
  '@/lib/db/drizzle': { db: database },
  'next/navigation': { redirect: (url) => { throw Object.assign(new Error('redirect'), { url }); } },
  'next/headers': { cookies: async () => ({ delete() {} }) },
  '@/lib/auth/session': {
    hashPassword: async value => `fixture:${value}`,
    comparePasswords: async (value, hash) => hash === `fixture:${value}`,
    setSession: async user => { sessions.push(user.id); },
  },
  '@/lib/db/queries': { getUser: async () => currentUser, getUserWithTeam: async () => null },
  '@/lib/extension-tokens': { revokeExtensionTokens: async () => {} },
  '@/lib/payments/stripe': { createCheckoutSession: async ({ priceId }) => { throw Object.assign(new Error('redirect'), { url: `checkout:${priceId}` }); } },
};
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} };
  cache.set(file, module);
  const output = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const localRequire = specifier => {
    if (Object.hasOwn(overrides, specifier)) return overrides[specifier];
    if (specifier.startsWith('@/')) return load(resolve(root, `${specifier.slice(2)}.ts`));
    if (specifier.startsWith('.')) return load(resolve(dirname(file), `${specifier}.ts`));
    return require(specifier);
  };
  new Function('require', 'module', 'exports', output)(localRequire, module, module.exports);
  return module.exports;
}
const service = load(resolve(root, 'lib/auth/email-verification.ts'));
const actions = load(resolve(root, 'app/(login)/actions.ts'));
const crypto = load(resolve(root, 'lib/auth/verification-code.ts'));
const mailer = load(resolve(root, 'lib/email/resend.ts'));
const template = load(resolve(root, 'lib/email/verification-template.ts'));
const originalFetch = globalThis.fetch;
const savedEnv = { ...process.env };
let sent = [];
let failDelivery = false;
let recipientNumber = 0;
const latestCode = () => sent.at(-1).body.text.match(/code is: (\d{6})/)[1];
const form = data => { const result = new FormData(); for (const [key, value] of Object.entries(data)) result.set(key, value); return result; };
async function user() {
  const email = `test-${++recipientNumber}@example.com`;
  return (await pg.query("INSERT INTO users (email,password_hash) VALUES ($1,'fixture:password123') RETURNING *", [email])).rows[0];
}
async function ageCodes(userId) { await pg.query("UPDATE email_verification_tokens SET created_at = created_at - interval '61 seconds' WHERE user_id = $1", [userId]); }

before(async () => {
  await pg.exec("SET TIME ZONE 'UTC'");
  await pg.exec(`CREATE TABLE users (id serial PRIMARY KEY, name varchar(100), email varchar(255) NOT NULL UNIQUE, password_hash text NOT NULL, role varchar(20) NOT NULL DEFAULT 'member', created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now(), deleted_at timestamp);
  CREATE TABLE teams (id serial PRIMARY KEY, name varchar(100) NOT NULL, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now(), stripe_customer_id text, stripe_subscription_id text, stripe_product_id text, plan_name varchar(50), subscription_status varchar(20));
  CREATE TABLE team_members (id serial PRIMARY KEY, user_id integer, team_id integer, role varchar(50), joined_at timestamp DEFAULT now());
  CREATE TABLE friend_invites (id serial PRIMARY KEY, inviter_user_id integer, token text, created_at timestamp DEFAULT now(), last_generated_at timestamp DEFAULT now());
  CREATE TABLE friend_invite_redemptions (id serial PRIMARY KEY, invite_id integer, invited_user_id integer UNIQUE, created_at timestamp DEFAULT now());
  CREATE TABLE invitations (id serial PRIMARY KEY, team_id integer, email varchar(255), role varchar(50), invited_by integer, invited_at timestamp DEFAULT now(), status varchar(20));
  CREATE TABLE activity_logs (id serial PRIMARY KEY, team_id integer, user_id integer, action text, timestamp timestamp DEFAULT now(), ip_address varchar(45));
  CREATE TABLE extension_api_tokens (id serial PRIMARY KEY, user_id integer, revoked_at timestamp);`);
  await pg.exec(readFileSync(resolve(root, 'lib/db/migrations/0003_email_verification.sql'), 'utf8'));
  await pg.exec(readFileSync(resolve(root, 'lib/db/migrations/0014_email_verification_codes.sql'), 'utf8'));
  await pg.exec(readFileSync(resolve(root, 'lib/db/migrations/0015_password_recovery.sql'), 'utf8'));
});
beforeEach(() => {
  sent = []; sessions = []; failDelivery = false; currentUser = null;
  process.env.AUTH_SECRET = 'fixture-only-secret-with-at-least-32-characters';
  process.env.RESEND_API_KEY = 'fixture-key';
  process.env.EMAIL_FROM = 'Reachard <noreply@example.com>';
  globalThis.fetch = async (url, options) => {
    assert.equal(url, 'https://api.resend.com/emails');
    sent.push({ headers: options.headers, body: JSON.parse(options.body) });
    return failDelivery ? new Response('{}', { status: 503 }) : Response.json({ id: 'fixture-message-id' });
  };
});
after(async () => {
  globalThis.fetch = originalFetch;
  for (const key of ['AUTH_SECRET', 'RESEND_API_KEY', 'EMAIL_FROM']) {
    if (savedEnv[key] === undefined) delete process.env[key]; else process.env[key] = savedEnv[key];
  }
  await pg.close();
});

test('unified access creates a new account, retains referral and checkout context, and requires verification', async () => {
  const inviter = await user();
  const invite = (await pg.query("INSERT INTO friend_invites(inviter_user_id,token) VALUES ($1,'unified-ref') RETURNING id", [inviter.id])).rows[0];
  await assert.rejects(actions.authenticate({}, form({
    email: '  NEW-UNIFIED@example.com ', password: 'password123',
    redirect: 'checkout', priceId: 'price_fixture', ref: 'unified-ref'
  })), error => {
    const url = new URL(error.url, 'https://example.com');
    return url.pathname === '/verify-email' && url.searchParams.get('redirect') === 'checkout'
      && url.searchParams.get('priceId') === 'price_fixture';
  });
  const record = (await pg.query("SELECT * FROM users WHERE email='new-unified@example.com'")).rows[0];
  assert.equal(record.email_verified_at, null);
  assert.equal(record.password_hash, 'fixture:password123');
  assert.deepEqual(sessions, []);
  assert.equal(sent.length, 1);
  const redemption = (await pg.query('SELECT * FROM friend_invite_redemptions WHERE invited_user_id=$1', [record.id])).rows[0];
  assert.equal(redemption.invite_id, invite.id);
});

test('unified access logs in an existing verified account without creating or mailing another account', async () => {
  const u = await user();
  await pg.query('UPDATE users SET email_verified_at=now() WHERE id=$1', [u.id]);
  const before = (await pg.query('SELECT count(*) AS count FROM users')).rows[0].count;
  await assert.rejects(actions.authenticate({}, form({ email: ` ${u.email.toUpperCase()} `,
    password: 'password123', redirect: '/connect-extension?source=unified' })),
    error => error.url === '/connect-extension?source=unified');
  assert.deepEqual(sessions, [u.id]);
  assert.equal(sent.length, 0);
  assert.equal((await pg.query('SELECT count(*) AS count FROM users')).rows[0].count, before);
});

test('unified access never falls back to registration for a wrong password or deleted account', async () => {
  const u = await user();
  const before = (await pg.query('SELECT count(*) AS count FROM users')).rows[0].count;
  const wrong = await actions.authenticate({}, form({ email: u.email, password: 'wrong-password' }));
  assert.match(wrong.error, /Invalid email or password/);
  await pg.query('UPDATE users SET deleted_at=now() WHERE id=$1', [u.id]);
  const deleted = await actions.authenticate({}, form({ email: u.email, password: 'password123' }));
  assert.match(deleted.error, /Invalid email or password/);
  assert.equal((await pg.query('SELECT count(*) AS count FROM users')).rows[0].count, before);
  assert.deepEqual(sessions, []);
  assert.equal(sent.length, 0);
});

test('unified access keeps unverified accounts behind email verification', async () => {
  const u = await user();
  await assert.rejects(actions.authenticate({}, form({ email: u.email, password: 'password123' })),
    error => error.url.startsWith('/verify-email?'));
  assert.deepEqual(sessions, []);
  assert.equal(sent.length, 1);
});

test('unified access rejects malformed credentials and unavailable delivery before registration', async () => {
  const invalid = await actions.authenticate({}, form({ email: 'invalid', password: 'short' }));
  assert.ok(invalid.error);
  delete process.env.RESEND_API_KEY;
  const unavailable = await actions.authenticate({}, form({ email: 'unified-unavailable@example.com', password: 'password123' }));
  assert.match(unavailable.error, /unavailable/);
  assert.equal((await pg.query("SELECT id FROM users WHERE email='unified-unavailable@example.com'")).rows.length, 0);
  assert.deepEqual(sessions, []);
  assert.equal(sent.length, 0);
});

test('signup sends a code, leaves email unverified, and creates no login session', async () => {
  const data = form({ email: 'signup@example.com', password: 'password123', redirect: '/connect-extension?source=test' });
  await assert.rejects(actions.signUp({}, data), error => error.url.includes('/verify-email?') && error.url.includes('sent=1'));
  const record = (await pg.query("SELECT * FROM users WHERE email='signup@example.com'")).rows[0];
  assert.equal(record.email_verified_at, null);
  assert.deepEqual(sessions, []);
  assert.equal(sent.length, 1);
  await assert.rejects(actions.confirmVerification({}, form({ email: record.email, code: latestCode(), redirect: '/connect-extension?source=test' })), error => error.url === '/connect-extension?source=test');
  assert.deepEqual(sessions, [record.id]);
  assert.ok((await pg.query('SELECT email_verified_at FROM users WHERE id=$1', [record.id])).rows[0].email_verified_at);
});

test('missing delivery config fails before an account is created', async () => {
  delete process.env.RESEND_API_KEY;
  const result = await actions.signUp({}, form({ email: 'unconfigured@example.com', password: 'password123' }));
  assert.match(result.error, /unavailable/);
  assert.equal((await pg.query("SELECT * FROM users WHERE email='unconfigured@example.com'")).rows.length, 0);
});

test('unverified password login sends a code instead of creating a session', async () => {
  const u = await user();
  await assert.rejects(actions.signIn({}, form({ email: u.email, password: 'password123' })), error => error.url.startsWith('/verify-email?'));
  assert.deepEqual(sessions, []);
  assert.equal(sent.length, 1);
});

test('changing email requires verification, while missing mail config leaves the old address intact', async () => {
  const u = await user();
  await pg.query('UPDATE users SET email_verified_at=now() WHERE id=$1', [u.id]);
  currentUser = { id: u.id, email: u.email, emailVerifiedAt: new Date(), sessionVersion: 0 };
  delete process.env.RESEND_API_KEY;
  const unavailable = await actions.updateAccount({}, form({ name: 'Test User', email: 'changed@example.com' }));
  assert.match(unavailable.error, /not been changed/);
  assert.equal((await pg.query('SELECT email FROM users WHERE id=$1', [u.id])).rows[0].email, u.email);
  process.env.RESEND_API_KEY = 'fixture-key';
  await assert.rejects(actions.updateAccount({}, form({ name: 'Test User', email: 'changed@example.com' })), error => error.url.includes('/verify-email?'));
  const updated = (await pg.query('SELECT * FROM users WHERE id=$1', [u.id])).rows[0];
  assert.equal(updated.email, 'changed@example.com');
  assert.equal(updated.email_verified_at, null);
  assert.deepEqual(sessions, []);
  assert.equal((await service.verifyEmailCode(updated.email, latestCode())).id, u.id);
});

test('delivery uses multipart content and an opaque idempotency key, never stores plaintext OTP', async () => {
  const u = await user();
  await service.issueEmailVerification(u.id, u.email);
  const code = latestCode();
  assert.match(code, /^\d{6}$/);
  assert.deepEqual(sent[0].body.to, [u.email]);
  assert.ok(sent[0].body.html.includes(code));
  assert.match(sent[0].headers['Idempotency-Key'], /^email-verification\/[a-f0-9]{64}$/);
  const record = (await pg.query('SELECT * FROM email_verification_tokens WHERE user_id=$1', [u.id])).rows[0];
  assert.notEqual(record.code_hash, code);
  assert.equal(new Date(record.expires_at) - new Date(record.created_at), 600000);
});

test('codes are bound to user and nonce, expire, and are single use', async () => {
  const u = await user(); const other = await user();
  await service.issueEmailVerification(u.id, u.email);
  const code = latestCode();
  assert.equal(await service.verifyEmailCode(other.email, code), null);
  assert.equal((await service.verifyEmailCode(u.email, code)).id, u.id);
  assert.equal(await service.verifyEmailCode(u.email, code), null);
  await service.issueEmailVerification(other.id, other.email);
  await pg.query("UPDATE email_verification_tokens SET expires_at=now()-interval '1 second' WHERE user_id=$1", [other.id]);
  assert.equal(await service.verifyEmailCode(other.email, latestCode()), null);
});

test('five incorrect guesses invalidate even the correct code', async () => {
  const u = await user(); await service.issueEmailVerification(u.id, u.email);
  const code = latestCode(); const wrong = code === '000000' ? '111111' : '000000';
  for (let i = 0; i < 5; i++) assert.equal(await service.verifyEmailCode(u.email, wrong), null);
  assert.equal(await service.verifyEmailCode(u.email, code), null);
  const record = (await pg.query('SELECT * FROM email_verification_tokens WHERE user_id=$1', [u.id])).rows[0];
  assert.equal(record.attempts, 5); assert.ok(record.used_at);
});

test('resend enforces 60 seconds, replaces the old challenge, and caps hourly sends', async () => {
  const u = await user(); await service.issueEmailVerification(u.id, u.email);
  const old = (await pg.query('SELECT * FROM email_verification_tokens WHERE user_id=$1', [u.id])).rows[0];
  await assert.rejects(service.issueEmailVerification(u.id, u.email), service.VerificationRateLimitError);
  for (let i = 0; i < 4; i++) { await ageCodes(u.id); await service.issueEmailVerification(u.id, u.email); }
  await ageCodes(u.id);
  await assert.rejects(service.issueEmailVerification(u.id, u.email), service.VerificationRateLimitError);
  assert.equal(sent.length, 5);
  assert.ok((await pg.query('SELECT used_at FROM email_verification_tokens WHERE id=$1', [old.id])).rows[0].used_at);
});

test('concurrent sends emit one email, and concurrent confirmations succeed once', async () => {
  const u = await user();
  const issuance = await Promise.allSettled([service.issueEmailVerification(u.id, u.email), service.issueEmailVerification(u.id, u.email)]);
  assert.equal(issuance.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(sent.length, 1);
  const confirmations = await Promise.all([service.verifyEmailCode(u.email, latestCode()), service.verifyEmailCode(u.email, latestCode())]);
  assert.equal(confirmations.filter(Boolean).length, 1);
});

test('delivery failure invalidates the code and signup offers recovery without login', async () => {
  failDelivery = true;
  await assert.rejects(actions.signUp({}, form({ email: 'delivery-failure@example.com', password: 'password123' })), error => error.url.includes('error=delivery'));
  assert.deepEqual(sessions, []);
  assert.equal(await service.verifyEmailCode('delivery-failure@example.com', latestCode()), null);
  const u = (await pg.query("SELECT id FROM users WHERE email='delivery-failure@example.com'")).rows[0];
  await ageCodes(u.id); failDelivery = false;
  const result = await actions.resendVerification({}, form({ email: 'delivery-failure@example.com' }));
  assert.ok(result.success);
  assert.equal((await service.verifyEmailCode('delivery-failure@example.com', latestCode())).id, u.id);
});

test('legacy link is accepted once; deleted users and verified users cannot obtain new codes', async () => {
  const u = await user(); const token = randomBytes(32).toString('base64url');
  await pg.query("INSERT INTO email_verification_tokens(user_id,token_hash,expires_at) VALUES ($1,$2,now()+interval '1 hour')", [u.id, createHash('sha256').update(token).digest('hex')]);
  assert.equal((await service.verifyEmailToken(token)).id, u.id);
  assert.equal(await service.verifyEmailToken(token), null);
  await service.issueEmailVerification(u.id, u.email); assert.equal(sent.length, 0);
  const deleted = await user(); await pg.query('UPDATE users SET deleted_at=now() WHERE id=$1', [deleted.id]);
  await service.issueEmailVerification(deleted.id, deleted.email); assert.equal(sent.length, 0);
});

test('template rejects injection; hash varies by user and challenge; redirects cannot leave app', () => {
  assert.throws(() => template.verificationEmail('<img>'));
  const a = crypto.hashVerificationCode(1, 'a', '000123', process.env.AUTH_SECRET);
  assert.notEqual(a, crypto.hashVerificationCode(2, 'a', '000123', process.env.AUTH_SECRET));
  assert.notEqual(a, crypto.hashVerificationCode(1, 'b', '000123', process.env.AUTH_SECRET));
  assert.equal(crypto.matchesVerificationCode(a, 'bad'), false);
  for (const url of ['https://evil.example', '//evil.example', '/\\evil.example', '/\nevil.example']) assert.equal(crypto.safeAuthRedirect(url), '/dashboard');
  assert.equal(crypto.safeAuthRedirect('/dashboard?source=invite'), '/dashboard?source=invite');
});

test('Resend HTTP errors, network errors, and malformed success responses fail closed', async () => {
  for (const response of [new Response('{}', { status: 429 }), Response.json({}), Response.json({ id: '' })]) {
    globalThis.fetch = async () => response;
    await assert.rejects(mailer.sendVerificationEmail('test@example.com', '000123', 'fixture'));
  }
  globalThis.fetch = async () => { throw new Error('network'); };
  await assert.rejects(mailer.sendVerificationEmail('test@example.com', '000123', 'fixture'));
});
