import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { hasActionAccess, hasUnlimitedAllowance } from './membership-policy.js';

// Exercise the actual migrations and account transactions in PostgreSQL WASM.
// Only the database transport is replaced; no paid provider or Stripe calls.
const pg = new PGlite();
const migrations = new URL('../../../web/lib/db/migrations/', import.meta.url);
const journal = JSON.parse(readFileSync(new URL('meta/_journal.json', migrations), 'utf8'));
for (const entry of journal.entries) {
  await pg.exec(readFileSync(new URL(`${entry.tag}.sql`, migrations), 'utf8'));
}
function tagged(client) {
  const query = (strings, ...values) => client.query(strings.reduce((text, part, i) => text + (i ? `$${i}` : '') + part, ''), values).then(result => result.rows);
  query.begin = callback => pg.transaction(tx => callback(tagged(tx)));
  query.json = value => JSON.stringify(value);
  query.end = async () => {};
  return query;
}
const oldDatabaseUrl = process.env.POSTGRES_URL;
process.env.POSTGRES_URL = 'postgresql://fixture/fixture';
globalThis.__reachardEntitlementSql = tagged(pg);
const source = readFileSync(new URL('./account.js', import.meta.url), 'utf8')
  .replace('import postgres from "postgres";', 'const postgres = () => globalThis.__reachardEntitlementSql;')
  + '\n//# sourceURL=reachard-account-fixture.js';
const account = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
delete globalThis.__reachardEntitlementSql;
const now = Math.floor(Date.now() / 1000);
const version = '2026-09-base50-plus-unlimited';
beforeEach(async () => {
  await pg.exec(`TRUNCATE users, teams CASCADE;
    INSERT INTO users (id,email,password_hash,email_verified_at,name) VALUES
      (1,'first@example.com','fixture',now(),'First'),(2,'second@example.com','fixture',now(),'Second');
    INSERT INTO teams (id,name,plan_name,subscription_status,stripe_subscription_id) VALUES
      (1,'First','Base','active','sub_first'),(2,'Second','Plus','active','sub_second');
    INSERT INTO team_members(user_id,team_id,role) VALUES(1,1,'owner'),(2,2,'owner');`);
});
after(async () => {
  if (oldDatabaseUrl === undefined) delete process.env.POSTGRES_URL; else process.env.POSTGRES_URL = oldDatabaseUrl;
  await pg.close();
});
async function grant({ userId = 1, mode = 'monthly', start = now - 60, end = now + 86400, legacy = false, amount, action = 'subscription.initial_grant' } = {}) {
  const metadata = { subscriptionId: userId === 1 ? 'sub_first' : 'sub_second', periodEnd: end,
    ...(legacy ? {} : { entitlementVersion: version, allowanceMode: mode, monthlyCredits: mode === 'monthly' ? 50 : 0,
      periodStart: start, priceId: mode === 'monthly' ? 'price_base9' : 'price_plus19' }) };
  const result = await pg.query('insert into credit_ledger(user_id,amount,action,metadata) values($1,$2,$3,$4) returning id',
    [userId, amount ?? (mode === 'monthly' ? 50 : 0), action, JSON.stringify(metadata)]);
  return result.rows[0].id;
}
async function reveal(key, email = `${key}@example.com`, userId = 1, contactKey = `linkedin:/in/${key}`) {
  await account.claimApiRequest({ userId, action: 'contacts.reveal', idempotencyKey: key });
  return account.chargeAndLogApiUsage({ userId, action: 'contacts.reveal', amount: 1, idempotencyKey: key,
    request: { contactKey }, response: { email, provider: 'fixture' } });
}

test('new Base includes exactly 50, ignores earlier grants, and atomically rejects the 51st reveal', async () => {
  await account.ensureFreeTrial(1);
  await grant({ legacy: true, amount: 100, end: now - 86400 });
  await grant({ action: 'subscription.monthly_grant' });
  assert.equal(await account.getCreditBalance(1), 50);
  const results = await Promise.all(Array.from({ length: 54 }, (_, i) => reveal(`person-${i}`)));
  assert.equal(results.filter(result => result.ok).length, 50);
  assert.equal(await account.getCreditBalance(1), 0);
  const state = await account.getBillingStateForUser(1);
  assert.equal(hasActionAccess(state, 'contacts.search', state.remaining), true);
  assert.equal(hasActionAccess(state, 'email.draft', state.remaining), true);
});

test('renewal replaces unused credits and an out-of-order older invoice cannot reset the current allowance', async () => {
  const previous = await grant({ start: now - 86400 * 30, end: now - 60 });
  await pg.query("insert into credit_ledger(user_id,amount,action,metadata) values(1,-20,'contacts.reveal',$1)", [JSON.stringify({ entitlementGrantId: previous })]);
  await grant({ action: 'subscription.monthly_grant' });
  await reveal('new-period');
  await grant({ action: 'subscription.monthly_grant', start: now - 86400 * 60, end: now - 86400 * 30 });
  assert.equal(await account.getCreditBalance(1), 49);
});

test('future paid periods do not become usable early and untagged rolling-deployment debits count', async () => {
  await grant();
  await grant({ action: 'subscription.monthly_grant', start: now + 86400, end: now + 86400 * 31 });
  await pg.exec("insert into credit_ledger(user_id,amount,action) values(1,-7,'contacts.reveal')");
  assert.equal(await account.getCreditBalance(1), 43);
});

test('Plus keeps working beyond the former 60 quota with no customer credit debits', async () => {
  await grant({ userId: 2, mode: 'unlimited' });
  const results = await Promise.all(Array.from({ length: 75 }, (_, i) => reveal(`plus-${i}`, `plus-${i}@example.com`, 2)));
  assert.ok(results.every(result => result.ok && result.response.credits.unlimited && result.response.credits.remaining === null));
  const state = await account.getBillingStateForUser(2);
  assert.equal(hasUnlimitedAllowance(state), true);
  assert.equal((await pg.query("select count(*)::int n from credit_ledger where user_id=2 and amount<0")).rows[0].n, 0);
  assert.equal((await pg.query("select count(*)::int n from api_usage where user_id=2 and action='contacts.reveal'")).rows[0].n, 75);
});

test('legacy Plus name retains its cumulative 60-credit allowance without acquiring unlimited', async () => {
  await grant({ userId: 2, legacy: true, amount: 60 });
  await grant({ userId: 2, legacy: true, amount: 60, action: 'subscription.monthly_grant' });
  await reveal('legacy', 'legacy@example.com', 2);
  const state = await account.getBillingStateForUser(2);
  assert.equal(state.allowanceMode, 'legacy');
  assert.equal(state.remaining, 119);
  assert.equal(state.unlimited, false);
  assert.equal(hasUnlimitedAllowance(state), false);
});

test('expired or canceled unlimited plans cannot finish new work admitted earlier', async () => {
  await grant({ mode: 'unlimited', end: now - 1, start: now - 86400 });
  assert.equal((await reveal('expired')).membershipRequired, true);
  await grant({ mode: 'unlimited', action: 'subscription.monthly_grant' });
  await pg.exec("update teams set subscription_status='canceled' where id=1");
  assert.equal((await reveal('canceled')).membershipRequired, true);
  assert.equal((await account.getBillingStateForUser(1)).unlimited, false);
});

test('expired Base reports no available monthly credits', async () => {
  await grant({ start: now - 86400, end: now - 1 });
  assert.equal(await account.getCreditBalance(1), 0);
});

test('same email under different concurrent keys charges once and unlock history survives idempotency cleanup', async () => {
  await grant();
  const results = await Promise.all(Array.from({ length: 8 }, (_, i) => reveal(`duplicate-${i}`, i % 2 ? 'SAME@example.com' : 'same@example.com', 1, 'linkedin:/in/shared')));
  assert.ok(results.every(result => result.ok));
  assert.equal(await account.getCreditBalance(1), 49);
  await pg.exec("update api_idempotency_keys set updated_at=now()-interval '8 days'");
  await account.pruneApiIdempotencyKeys();
  assert.equal((await pg.query('select count(*)::int n from api_idempotency_keys')).rows[0].n, 0);
  assert.equal(await account.hasRevealedEmail(1, 'SAME@example.com'), true);
  assert.equal(await account.hasRevealedEmail(2, 'same@example.com'), false);
  assert.equal((await account.getPreviouslyRevealedContact(1, { linkedinUrl: 'https://www.linkedin.com/in/shared/' })).email, 'same@example.com');
  assert.equal(await account.getPreviouslyRevealedContact(2, { linkedinUrl: 'https://www.linkedin.com/in/shared/' }), null);
});

test('existing unlocks remain accessible at zero allowance without recording another debit', async () => {
  const id = await grant();
  await reveal('owned', 'owned@example.com');
  await pg.query("insert into credit_ledger(user_id,amount,action,metadata) values(1,-49,'contacts.reveal',$1)", [JSON.stringify({ entitlementGrantId: id })]);
  assert.equal(await account.getCreditBalance(1), 0);
  const repeated = await reveal('owned-again', 'owned@example.com');
  assert.equal(repeated.ok, true);
  assert.equal(repeated.response.alreadyUnlocked, true);
  assert.equal(repeated.response.credits.remaining, 0);
  const miss = await account.claimApiRequest({ userId: 1, action: 'contacts.reveal', idempotencyKey: 'no-email' });
  assert.equal(miss.status, 'claimed');
  await account.failApiRequest({ userId: 1, action: 'contacts.reveal', idempotencyKey: 'no-email', error: 'email_not_found' });
  assert.equal(await account.getCreditBalance(1), 0);
});

test('replay reflects the current period balance and cannot debit twice', async () => {
  await grant();
  await reveal('replay');
  await reveal('different');
  const replayed = await account.chargeAndLogApiUsage({ userId: 1, action: 'contacts.reveal', amount: 1, idempotencyKey: 'replay' });
  assert.equal(replayed.replayed, true);
  assert.equal(replayed.response.credits.remaining, 48);
});

test('a request key whose response expired cannot bypass a durable debit or repeat paid work', async () => {
  await grant();
  await reveal('old-request');
  await pg.exec("update api_idempotency_keys set updated_at=now()-interval '8 days'");
  await account.pruneApiIdempotencyKeys();
  const reused = await account.claimApiRequest({ userId: 1, action: 'contacts.reveal', idempotencyKey: 'old-request' });
  assert.equal(reused.status, 'expired');
  assert.equal(await account.getCreditBalance(1), 49);
});

test('health requires the shared entitlement migration', async () => {
  assert.equal(await account.checkAccountDb(), true);
  await pg.exec('alter table contact_email_unlocks rename to contact_email_unlocks_missing');
  try { await assert.rejects(account.checkAccountDb(), /migrations/); }
  finally { await pg.exec('alter table contact_email_unlocks_missing rename to contact_email_unlocks'); }
});

test('a missing provider receipt stays unknown in durable cost reporting', async () => {
  await grant();
  await account.claimApiRequest({ userId: 1, action: 'contacts.search', idempotencyKey: 'unknown-cost' });
  await account.chargeAndLogApiUsage({ userId: 1, action: 'contacts.search', amount: 0,
    idempotencyKey: 'unknown-cost', response: { contacts: [] }, internalCost: { provider: 'fixture', costMicroUsd: null } });
  const response = (await pg.query("select response from api_usage where request_id='unknown-cost'")).rows[0].response;
  assert.equal(Object.hasOwn(response.internalCost, 'costMicroUsd'), false);
});

test('contact identity keys normalize LinkedIn aliases and Apollo IDs without accepting blank or unrelated identities', () => {
  assert.equal(account.getContactKey({ linkedinUrl: 'https://linkedin.com/in/Alex-Example/?trk=fixture#about' }), 'linkedin:/in/alex-example');
  assert.equal(account.getContactKey({ linkedinUrl: 'http://www.linkedin.com/in/alex-example' }), 'linkedin:/in/alex-example');
  assert.equal(account.getContactKey({ apolloId: '  apollo-123  ' }), 'apollo:apollo-123');
  for (const input of [{ apolloId: ' ' }, { apolloId: {} }, { linkedinUrl: 'https://linkedin.com.evil.test/in/alex-example' },
    { linkedinUrl: 'https://linkedin.com/company/example' }, { linkedinUrl: 'javascript://linkedin.com/in/alex-example' },
    { linkedinUrl: 'https://linkedin.com/in/alex-example/posts' }, { provider: 'linkedin', id: '/in/alex-example' }]) {
    assert.equal(account.getContactKey(input), '');
  }
});

test('same-person updated emails remain separate unlocks and never cross account boundaries', async () => {
  await grant(); await grant({ userId: 2 });
  await reveal('old-address', 'old-work@example.com', 1, 'apollo:same-person');
  await reveal('new-address', 'new-work@example.com', 1, 'apollo:same-person');
  await pg.exec("update contact_email_unlocks set created_at=now()-interval '1 day' where email='old-work@example.com'");
  assert.equal((await account.getPreviouslyRevealedContact(1, { apolloId: 'same-person' })).email, 'new-work@example.com');
  assert.equal(await account.hasRevealedEmail(1, 'old-work@example.com'), true);
  assert.equal(await account.getPreviouslyRevealedContact(2, { apolloId: 'same-person', email: 'old-work@example.com' }), null);
  assert.equal(await account.hasRevealedEmail(2, 'new-work@example.com'), false);
  await reveal('other-user-address', 'other-work@example.com', 2, 'apollo:same-person');
  assert.equal((await account.getPreviouslyRevealedContact(2, { apolloId: 'same-person' })).email, 'other-work@example.com');
  assert.equal((await account.getPreviouslyRevealedContact(1, { apolloId: 'same-person' })).email, 'new-work@example.com');
});


test('request digests canonicalize object keys while preserving payload types and array order', () => {
  assert.equal(account.fingerprintRequest({ b: 2, a: { y: 2, x: 1 } }), account.fingerprintRequest({ a: { x: 1, y: 2 }, b: 2 }));
  assert.notEqual(account.fingerprintRequest({ a: [1, 2] }), account.fingerprintRequest({ a: [2, 1] }));
  assert.notEqual(account.fingerprintRequest({ a: 1 }), account.fingerprintRequest({ a: '1' }));
});

test('same-key different-payload conflicts in processing, failed, stale and succeeded states', async () => {
  await grant();
  const value = { userId: 1, action: 'contacts.search', idempotencyKey: 'bound', request: { companyName: 'First' } };
  assert.equal((await account.claimApiRequest(value)).status, 'claimed');
  for (const status of ['processing', 'failed', 'succeeded']) {
    await pg.query(`update api_idempotency_keys set status=$1, response=$2, updated_at=now()-interval '10 minutes'`, [status, JSON.stringify({ contacts: ['original'] })]);
    const before = (await pg.query('select * from api_idempotency_keys')).rows[0];
    assert.equal((await account.claimApiRequest({ ...value, request: { companyName: 'Second' } })).status, 'conflict');
    assert.deepEqual((await pg.query('select * from api_idempotency_keys')).rows[0], before);
  }
  const replay = await account.claimApiRequest(value);
  assert.equal(replay.status, 'replay');
  assert.deepEqual(replay.response, { contacts: ['original'] });
});

test('matching failed requests retry immediately and simultaneous claims admit only one operation', async () => {
  const value = { userId: 1, action: 'contacts.search', idempotencyKey: 'retry', request: { companyName: 'First' } };
  const claims = await Promise.all(Array.from({ length: 6 }, () => account.claimApiRequest(value)));
  assert.equal(claims.filter(r => r.status === 'claimed').length, 1);
  assert.equal(claims.filter(r => r.status === 'processing').length, 5);
  await account.failApiRequest({ ...value, error: 'validation_failed' });
  assert.equal((await account.claimApiRequest(value)).status, 'claimed');
});

test('historical requests without a payload digest are never replayed or rerun', async () => {
  for (const status of ['processing', 'failed', 'succeeded']) {
    const key = `legacy-${status}`;
    await pg.query(`insert into api_idempotency_keys(user_id,action,idempotency_key,status,updated_at) values(1,$1,$2,$3,now()-interval '10 minutes')`, ['contacts.search', key, status]);
    assert.equal((await account.claimApiRequest({ userId: 1, action: 'contacts.search', idempotencyKey: key, request: { companyName: 'Unknown' } })).status, 'unverifiable');
    assert.equal((await pg.query('select status from api_idempotency_keys where idempotency_key=$1', [key])).rows[0].status, status);
  }
});

test('health requires the additive request-digest migration', async () => {
  assert.equal(await account.checkAccountDb(), true);
  await pg.exec('alter table api_idempotency_keys rename column request_hash to request_hash_missing');
  try { await assert.rejects(account.checkAccountDb(), /migrations/); }
  finally { await pg.exec('alter table api_idempotency_keys rename column request_hash_missing to request_hash'); }
});


test('processing expiry uses database time under different session timezones', async () => {
  try {
    for (const zone of ['UTC', 'America/Los_Angeles']) {
      await pg.exec(`set timezone to '${zone}'`);
      const value = { userId: 1, action: 'contacts.search', idempotencyKey: `timezone-${zone}`, request: {} };
      assert.equal((await account.claimApiRequest(value)).status, 'claimed');
      assert.equal((await account.claimApiRequest(value)).status, 'processing');
      await pg.query("update api_idempotency_keys set updated_at=now()-interval '6 minutes' where idempotency_key=$1", [value.idempotencyKey]);
      assert.equal((await account.claimApiRequest(value)).status, 'claimed');
    }
  } finally { await pg.exec("set timezone to 'UTC'"); }
});
