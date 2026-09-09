const assert = require('node:assert/strict');
const { test, before, beforeEach, after } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
const { drizzle } = require('drizzle-orm/pglite');
const { eq } = require('drizzle-orm');
const root = path.resolve(__dirname, '..');
const pg = new PGlite();
const db = drizzle(pg);
const modules = new Map();
let schema, currentUser, teamPause, verificationCalls, cancellationCalls, sessions;
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const overrides = {
  'server-only': {},
  '@/lib/db/drizzle': { db },
  'next/navigation': { redirect: url => { throw Object.assign(new Error('redirect'), { url }); } },
  'next/headers': { cookies: async () => ({ delete() {} }) },
  'next/server': { after: () => {} },
  '@/lib/auth/session': {
    hashPassword: async value => `fixture:${value}`,
    comparePasswords: async (value, hash) => hash === `fixture:${value}`,
    setSession: async user => { sessions.push(user); },
  },
  '@/lib/db/queries': {
    getUser: async () => currentUser,
    getUserWithTeam: async () => {
      if (teamPause) { teamPause.started.resolve(); await teamPause.resume.promise; }
      return { teamId: 7, teamRole: 'owner', stripeSubscriptionId: 'sub_fixture' };
    },
  },
  '@/lib/email/resend': { requireEmailDelivery() {}, sendPasswordResetEmail: async () => {}, sendPasswordChangedEmail: async () => {} },
  '@/lib/auth/email-verification': {
    issueEmailVerification: async (...args) => { verificationCalls.push(args); },
    VerificationRateLimitError: class extends Error {},
  },
  '@/lib/payments/stripe': { cancelSubscriptionAtPeriodEnd: async () => { cancellationCalls += 1; } },
};
function load(file) {
  if (modules.has(file)) return modules.get(file).exports;
  const mod = { exports: {} }; modules.set(file, mod);
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true,
  } }).outputText;
  const localRequire = spec => {
    if (Object.hasOwn(overrides, spec)) return overrides[spec];
    if (spec.startsWith('@/')) return load(path.join(root, spec.slice(2) + '.ts'));
    if (spec.startsWith('.')) return load(path.resolve(path.dirname(file), spec + '.ts'));
    return require(spec);
  };
  new Function('require', 'module', 'exports', source)(localRequire, mod, mod.exports);
  return mod.exports;
}
schema = load(path.join(root, 'lib/db/schema.ts'));
const actions = load(path.join(root, 'app/(login)/actions.ts'));
const recovery = load(path.join(root, 'lib/auth/password-reset.ts'));
const resetActions = load(path.join(root, 'app/(login)/password-reset-actions.ts'));
const resetTokens = load(path.join(root, 'lib/auth/password-reset-token.ts'));
const policy = load(path.join(root, 'lib/auth/password-policy.ts'));
const deletion = load(path.join(root, 'lib/delete-account-data.ts'));
const form = values => { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data; };
const userRow = async () => (await db.select().from(schema.users).where(eq(schema.users.id, 1)))[0];
async function resetLink() {
  const token = crypto.randomBytes(32).toString('base64url');
  const user = await userRow();
  await db.insert(schema.passwordResetTokens).values({ userId: user.id, email: user.email, sessionVersion: user.sessionVersion,
    tokenHash: resetTokens.hashPasswordResetToken(token), expiresAt: new Date(Date.now() + 600000) });
  return token;
}
before(async () => {
  await pg.exec(`
    CREATE TABLE users (id integer PRIMARY KEY, name varchar(100), email varchar(255) UNIQUE NOT NULL, email_verified_at timestamp,
      password_hash text NOT NULL, role varchar(20) DEFAULT 'member', created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now(), deleted_at timestamp);
    CREATE TABLE teams (id integer PRIMARY KEY, name varchar(100), created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now(), stripe_customer_id text,
      stripe_subscription_id text, stripe_product_id text, plan_name varchar(50), subscription_status varchar(20));
    CREATE TABLE team_members (id serial PRIMARY KEY, user_id integer, team_id integer, role varchar(50), joined_at timestamp DEFAULT now());
    CREATE TABLE extension_api_tokens (id serial PRIMARY KEY, user_id integer, revoked_at timestamp);
    CREATE TABLE email_verification_tokens (id serial PRIMARY KEY, user_id integer, used_at timestamp);
    CREATE TABLE user_settings (id serial PRIMARY KEY, user_id integer, resume_context text);
    CREATE TABLE api_idempotency_keys (id serial PRIMARY KEY, user_id integer);
    CREATE TABLE activity_logs (id serial PRIMARY KEY, team_id integer, user_id integer, action text, ip_address text, timestamp timestamp DEFAULT now());
  `);
  await pg.exec(fs.readFileSync(path.join(root, 'lib/db/migrations/0015_password_recovery.sql'), 'utf8'));
});
beforeEach(async () => {
  await pg.exec(`TRUNCATE password_reset_tokens, users, teams, team_members, extension_api_tokens, email_verification_tokens, user_settings, api_idempotency_keys, activity_logs RESTART IDENTITY;
    INSERT INTO users (id,name,email,password_hash,email_verified_at) VALUES (1,'User','user@example.com','fixture:oldpassword',now());
    INSERT INTO teams (id,name,stripe_subscription_id) VALUES (7,'Team','sub_fixture');
    INSERT INTO team_members (user_id,team_id,role) VALUES (1,7,'owner');
    INSERT INTO extension_api_tokens (user_id) VALUES (1);
    INSERT INTO email_verification_tokens (user_id) VALUES (1);
    INSERT INTO user_settings (user_id,resume_context) VALUES (1,'private fixture');
  `);
  currentUser = await userRow(); teamPause = null; verificationCalls = []; cancellationCalls = 0; sessions = [];
});
after(async () => { await pg.close(); });

test('email update authenticated before recovery cannot regain access after the reset commits', async () => {
  const token = await resetLink();
  teamPause = { started: deferred(), resume: deferred() };
  const pending = actions.updateAccount({}, form({ name: 'Attacker', email: 'attacker@example.com' }));
  await teamPause.started.promise;
  assert.ok(await recovery.resetPassword(token, 'newpassword'));
  teamPause.resume.resolve();
  assert.match((await pending).error, /credentials have changed/);
  const user = await userRow();
  assert.equal(user.email, 'user@example.com'); assert.equal(user.sessionVersion, 1);
  assert.equal(user.passwordHash, 'fixture:newpassword');
  assert.equal(verificationCalls.length, 0); assert.equal(sessions.length, 0);
});

test('deletion authenticated with an old password cannot cancel billing or delete after recovery', async () => {
  const token = await resetLink();
  teamPause = { started: deferred(), resume: deferred() };
  const pending = actions.deleteAccount({}, form({ password: 'oldpassword' }));
  await teamPause.started.promise;
  assert.ok(await recovery.resetPassword(token, 'newpassword'));
  teamPause.resume.resolve();
  assert.match((await pending).error, /credentials have changed/);
  assert.equal((await userRow()).deletedAt, null);
  assert.equal(cancellationCalls, 0);
  assert.equal((await pg.query('SELECT * FROM user_settings')).rows.length, 1);
});

test('email changes atomically rotate the version and revoke extension and recovery credentials', async () => {
  const token = await resetLink();
  await assert.rejects(actions.updateAccount({}, form({ name: 'Changed', email: 'changed@example.com' })), error => error.url.startsWith('/verify-email?'));
  const user = await userRow();
  assert.equal(user.sessionVersion, 1); assert.equal(user.emailVerifiedAt, null);
  assert.equal(user.email, 'changed@example.com');
  assert.ok((await pg.query('SELECT revoked_at FROM extension_api_tokens')).rows[0].revoked_at);
  assert.ok((await pg.query('SELECT used_at FROM email_verification_tokens')).rows[0].used_at);
  assert.equal(await recovery.resetPassword(token, 'newpassword'), null);
  assert.equal(verificationCalls.length, 1);
});

test('failure to revoke a credential rolls the email/version/token changes back together', async () => {
  await resetLink();
  await pg.exec('ALTER TABLE password_reset_tokens ADD CONSTRAINT force_rollback CHECK (used_at IS NULL)');
  try {
    await assert.rejects(actions.updateAccount({}, form({ name: 'Changed', email: 'changed@example.com' })));
    const user = await userRow();
    assert.equal(user.email, 'user@example.com'); assert.equal(user.sessionVersion, 0);
    assert.equal((await pg.query('SELECT revoked_at FROM extension_api_tokens')).rows[0].revoked_at, null);
    assert.equal((await pg.query('SELECT used_at FROM email_verification_tokens')).rows[0].used_at, null);
    assert.equal(verificationCalls.length, 0);
  } finally { await pg.exec('ALTER TABLE password_reset_tokens DROP CONSTRAINT force_rollback'); }
});

test('deletion rechecks the hash as well as the version before its billing callback', async () => {
  const expected = { sessionVersion: 0, passwordHash: 'fixture:oldpassword' };
  await pg.exec("UPDATE users SET password_hash='fixture:changed' WHERE id=1");
  assert.equal(await deletion.deleteAccountData(1, 7, expected, async () => { cancellationCalls++; }), false);
  assert.equal(cancellationCalls, 0); assert.equal((await userRow()).deletedAt, null);
});

test('an old password-change request cannot renew itself after an email credential rotation', async () => {
  const pendingUser = currentUser;
  await assert.rejects(actions.updateAccount({}, form({ name: 'Changed', email: 'changed@example.com' })), error => error.url.startsWith('/verify-email?'));
  assert.equal((await userRow()).passwordHash, pendingUser.passwordHash);
  currentUser = pendingUser;
  const changed = await actions.updatePassword({}, form({ currentPassword: 'oldpassword', newPassword: 'newpassword', confirmPassword: 'newpassword' }));
  assert.match(changed.error, /sign in again/);
  assert.equal((await userRow()).passwordHash, pendingUser.passwordHash);
  assert.equal(sessions.length, 0);
});

test('new-password validation respects the 72-byte bcrypt boundary across ASCII and Unicode', async () => {
  for (const password of ['a'.repeat(72), '汉'.repeat(24), '😀'.repeat(18)]) {
    assert.equal(policy.isSupportedNewPassword(password), true);
    assert.equal(policy.newPasswordSchema.safeParse(password).success, true);
  }
  for (const password of ['a'.repeat(73), '汉'.repeat(25), '😀'.repeat(19)]) {
    assert.equal(policy.isSupportedNewPassword(password), false);
    assert.match((await actions.signUp({}, form({ email: 'new@example.com', password }))).error, /72/);
    assert.match((await actions.updatePassword({}, form({ currentPassword: 'oldpassword', newPassword: password, confirmPassword: password }))).error, /72/);
    const token = await resetLink();
    assert.equal(await recovery.resetPassword(token, password), null);
    assert.match((await resetActions.confirmPasswordReset({}, form({ token, password, confirmPassword: password }))).error, /72/);
  }
  assert.equal((await userRow()).passwordHash, 'fixture:oldpassword');
});

test('existing long-password sign-in remains compatible while new creation is limited', async () => {
  const password = 'a'.repeat(90);
  await db.update(schema.users).set({ passwordHash: `fixture:${password}` }).where(eq(schema.users.id, 1));
  await assert.rejects(actions.signIn({}, form({ email: 'user@example.com', password })), error => error.url === '/dashboard');
  assert.equal(sessions.length, 1);
});
