import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import { hasActionAccess } from '../../server/src/lib/membership-policy.js';

// Actual migration functions and account SQL, with only the PostgreSQL
// transport replaced. This never calls Stripe, email or contact providers.
const root = fileURLToPath(new URL('..', import.meta.url));
const pg = new PGlite();
const journal = JSON.parse(readFileSync(resolve(root, 'lib/db/migrations/meta/_journal.json'), 'utf8'));
for (const entry of journal.entries.filter(entry => entry.idx <= 18)) {
  await pg.exec(readFileSync(resolve(root, 'lib/db/migrations', entry.tag + '.sql'), 'utf8'));
}
const require = createRequire(import.meta.url);
function tagged(client) {
  const query = (strings, ...values) => client.query(strings.reduce((text, part, i) => text + (i ? `$${i}` : '') + part, ''), values).then(r => r.rows);
  query.begin = fn => pg.transaction(tx => fn(tagged(tx)));
  query.json = value => JSON.stringify(value);
  query.end = async () => {};
  return query;
}
process.env.POSTGRES_URL = 'postgresql://fixture/fixture';
const accountSource = readFileSync(resolve(root, '../server/src/lib/account.js'), 'utf8');
const compiled = ts.transpileModule(accountSource, { compilerOptions: {
  module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true,
} }).outputText;
const module = { exports: {} };
new Function('require', 'module', 'exports', compiled)(name => name === 'postgres' ? () => tagged(pg) : require(name), module, module.exports);
const account = module.exports;
beforeEach(async () => {
  await pg.exec(`TRUNCATE users, teams CASCADE;
    INSERT INTO users (id,email,password_hash,email_verified_at,name) VALUES
    (1,'trial@example.com','fixture',now(),'Trial'),(2,'other@example.com','fixture',now(),'Other');
    INSERT INTO teams (id,name) VALUES (1,'Trial team'),(2,'Other team');
    INSERT INTO team_members (user_id,team_id,role) VALUES (1,1,'owner'),(2,2,'owner');`);
});
after(() => pg.close());

test('health rejects missing trial migrations instead of advertising readiness', async () => {
  assert.equal(await account.checkAccountDb(), true);
  await pg.exec('ALTER TABLE free_trial_claims RENAME TO free_trial_claims_missing');
  try { await assert.rejects(account.checkAccountDb(), /migrations/); }
  finally { await pg.exec('ALTER TABLE free_trial_claims_missing RENAME TO free_trial_claims'); }
});

test('concurrent first visits grant exactly three credits and no subscription', async () => {
  const results = await Promise.all(Array.from({ length: 12 }, () => account.ensureFreeTrial(1)));
  assert.ok(results.every(Boolean));
  assert.equal(await account.getCreditBalance(1), 3);
  assert.equal((await pg.query("select count(*)::int n from credit_ledger where user_id=1")).rows[0].n, 1);
  assert.equal((await pg.query('select stripe_subscription_id from teams where id=1')).rows[0].stripe_subscription_id, null);
  assert.equal((await account.getMembershipForUser(1)).status, 'free_trial');
});

test('unverified, deleted and previously subscribed users do not receive a trial', async () => {
  await pg.exec('update users set email_verified_at=null where id=1');
  assert.equal(await account.ensureFreeTrial(1), false);
  await pg.exec('update users set email_verified_at=now(),deleted_at=now() where id=1');
  assert.equal(await account.ensureFreeTrial(1), false);
  await pg.exec("update users set deleted_at=null where id=1; insert into credit_ledger(user_id,amount,action) values(1,20,'subscription.initial_grant')");
  assert.equal(await account.ensureFreeTrial(1), false);
  assert.equal(await account.getCreditBalance(1), 20);
});

test('deleting and recreating the same verified email cannot claim another trial', async () => {
  await account.ensureFreeTrial(1);
  await pg.exec("update users set deleted_at=now(),email='deleted-1@deleted.invalid' where id=1; update users set email='TRIAL@example.com' where id=2");
  assert.equal(await account.ensureFreeTrial(2), false);
  assert.equal(await account.getCreditBalance(2), 0);
});

test('four simultaneous successful reveals can debit only the three free credits', async () => {
  await account.ensureFreeTrial(1);
  for (let i = 0; i < 4; i++) await account.claimApiRequest({ userId: 1, action: 'contacts.reveal', idempotencyKey: `reveal-${i}` });
  const results = await Promise.all(Array.from({ length: 4 }, (_, i) => account.chargeAndLogApiUsage({
    userId: 1, action: 'contacts.reveal', amount: 1, idempotencyKey: `reveal-${i}`,
    request: { companyName: 'Example' }, response: { email: `person${i}@example.com` },
  })));
  assert.equal(results.filter(result => result.ok).length, 3);
  assert.equal(await account.getCreditBalance(1), 0);
  const replay = await account.chargeAndLogApiUsage({ userId: 1, action: 'contacts.reveal', amount: 1, idempotencyKey: 'reveal-0' });
  assert.equal(replay.replayed, true);
  assert.equal(await account.getCreditBalance(1), 0);
});

test('a missed email costs no trial credit and cannot become a drafted contact', async () => {
  await account.ensureFreeTrial(1);
  await account.claimApiRequest({ userId: 1, action: 'contacts.reveal', idempotencyKey: 'miss' });
  await account.failApiRequest({ userId: 1, action: 'contacts.reveal', idempotencyKey: 'miss', error: 'email_not_found' });
  assert.equal(await account.getCreditBalance(1), 3);
  assert.equal(await account.hasRevealedEmail(1, 'missing@example.com'), false);
});

test('the third revealed contact can still be drafted at zero credits; another user cannot reuse it', async () => {
  await account.ensureFreeTrial(1);
  await account.claimApiRequest({ userId: 1, action: 'contacts.reveal', idempotencyKey: 'last' });
  await account.chargeAndLogApiUsage({ userId: 1, action: 'contacts.reveal', amount: 3, idempotencyKey: 'last', request: {}, response: { email: 'last@example.com' } });
  const membership = await account.getMembershipForUser(1);
  assert.equal(hasActionAccess(membership, 'contacts.reveal', 0), false);
  assert.equal(hasActionAccess(membership, 'contacts.search', 0), false);
  assert.equal(hasActionAccess(membership, 'email.draft', 0), true);
  assert.equal(await account.hasRevealedEmail(1, 'last@example.com'), true);
  assert.equal(await account.hasRevealedEmail(2, 'last@example.com'), false);
});

test('free trial provider attempt caps are atomic and persist across repeated requests', async () => {
  await account.ensureFreeTrial(1);
  for (const [action, limit] of [['contacts.search', 20], ['contacts.reveal', 30], ['email.draft', 12]]) {
    const attempts = await Promise.all(Array.from({ length: limit + 4 }, () => account.consumeFreeTrialOperation(1, action)));
    assert.equal(attempts.filter(Boolean).length, limit);
    assert.equal(await account.consumeFreeTrialOperation(1, action), false);
  }
  assert.equal(await account.consumeFreeTrialOperation(1, 'unknown'), false);
  assert.equal(await account.getCreditBalance(1), 3);
});

test('subscription access replaces trial access and cannot revert after a paid period ends', async () => {
  await account.ensureFreeTrial(1);
  const periodEnd = Math.floor(Date.now()/1000) + 86400;
  await pg.query("insert into credit_ledger(user_id,amount,action,metadata) values (1,20,'subscription.initial_grant',$1)", [JSON.stringify({ subscriptionId: 'sub_fixture', periodEnd })]);
  await pg.exec("update teams set subscription_status='active',stripe_subscription_id='sub_fixture' where id=1");
  assert.equal(await account.ensureFreeTrial(1), false);
  const membership = await account.getMembershipForUser(1);
  assert.equal(hasActionAccess(membership, 'contacts.search', 0), true);
  assert.equal(hasActionAccess(membership, 'email.draft', 20, (periodEnd + 1) * 1000), false);
  await pg.exec("update teams set subscription_status='canceled' where id=1");
  assert.equal((await account.getMembershipForUser(1)).status, 'canceled');
});
