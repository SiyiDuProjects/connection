import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const folder = new URL('../lib/db/migrations/', import.meta.url);
const journal = JSON.parse(readFileSync(new URL('meta/_journal.json', folder), 'utf8')).entries;
const source = tag => readFileSync(new URL(`${tag}.sql`, folder), 'utf8');
const expand = source('0021_personal_billing_accounts');
const contract = source('0022_retire_team_model');
async function legacy() {
  const db = new PGlite();
  for (const entry of journal.filter(entry => entry.idx <= 20)) await db.exec(source(entry.tag));
  await db.exec(`INSERT INTO users(id,email,password_hash) VALUES
    (1,'base@example.test','hash'),(2,'plus@example.test','hash'),(3,'legacy@example.test','hash');
    INSERT INTO teams(id,name,stripe_customer_id,stripe_subscription_id,subscription_status) VALUES
    (11,'Base','cus_1','sub_1','active'),(12,'Plus','cus_2','sub_2','active'),(13,'Legacy','cus_3','sub_3','past_due');
    SELECT setval('teams_id_seq',13);
    INSERT INTO team_members(user_id,team_id,role) VALUES(1,11,'owner'),(2,12,'owner'),(3,13,'owner');
    INSERT INTO activity_logs(team_id,user_id,action) VALUES(11,1,'SIGN_UP'),(12,null,'CREATE_TEAM');
    INSERT INTO credit_ledger(user_id,amount,action,metadata) SELECT u.id,
      CASE WHEN u.id=1 THEN 50 WHEN u.id=2 THEN 0 ELSE 60 END,'subscription.initial_grant',
      jsonb_build_object('subscriptionId','sub_'||u.id,'periodEnd',extract(epoch from now())::bigint+86400)
      || CASE WHEN u.id<3 THEN jsonb_build_object('periodStart',extract(epoch from now())::bigint-86400,
        'entitlementVersion','2026-09-base50-plus-unlimited','allowanceMode',CASE WHEN u.id=1 THEN 'monthly' ELSE 'unlimited' END)
        ELSE '{}'::jsonb END FROM users u;
    INSERT INTO contact_email_unlocks(user_id,email_fingerprint,email) VALUES(1,'fixture','saved@example.test');
    INSERT INTO extension_api_tokens(user_id,token_hash) VALUES(1,'legacy-token-hash');
    INSERT INTO friend_invites(inviter_user_id,token) VALUES(1,'referral');
    INSERT INTO friend_invite_redemptions(invite_id,invited_user_id) VALUES(1,2);
    CREATE TABLE team_members_backup_0013 AS TABLE team_members;
    CREATE TABLE extension_api_tokens_backup_0013 AS TABLE extension_api_tokens;`);
  return db;
}
async function snapshot(db) {
  const read = async query => (await db.query(query)).rows;
  return {
    entitlement: await read('select u.id,e.* from users u cross join lateral get_account_entitlement(u.id) e order by u.id'),
    ledger: await read('select * from credit_ledger order by id'),
    activity: await read('select id,user_id,action,timestamp,ip_address from activity_logs order by id'),
    unlocks: await read('select * from contact_email_unlocks'),
    tokens: await read('select * from extension_api_tokens'),
    referrals: await read('select * from friend_invite_redemptions'),
  };
}
test('expand and contract preserve IDs, purchases, entitlements, logs, unlocks, credentials and referrals', async () => {
  const db = await legacy();
  try {
    const before = await snapshot(db);
    await db.exec(expand);
    assert.deepEqual(await snapshot(db), before);
    await db.exec(contract);
    assert.deepEqual(await snapshot(db), before);
    assert.deepEqual((await db.query('select id,user_id,stripe_customer_id from billing_accounts order by id')).rows,
      [1,2,3].map((user_id,i) => ({id:11+i,user_id,stripe_customer_id:`cus_${user_id}`})));
    for (const name of ['teams','team_members','invitations','team_members_backup_0013','extension_api_tokens_backup_0013']) {
      assert.equal((await db.query('select to_regclass($1) relation',[name])).rows[0].relation,null);
    }
    await assert.rejects(db.exec('insert into billing_accounts(user_id) values(1)'), /unique/);
    await assert.rejects(db.exec('insert into billing_accounts default values'), /null/);
  } finally { await db.close(); }
});

test('during rollout both old and new signup, subscription updates, and log writes remain usable', async () => {
  const db = await legacy();
  try {
    await db.exec(expand);
    await db.exec(`INSERT INTO users(id,email,password_hash) VALUES(4,'old@example.test','hash'),(5,'new@example.test','hash');
      INSERT INTO teams(name) VALUES('Old signup');
      INSERT INTO team_members(user_id,team_id,role) VALUES(4,14,'owner');
      INSERT INTO billing_accounts(user_id) VALUES(5);
      UPDATE teams SET subscription_status='active',stripe_customer_id='cus_new' WHERE id=15;
      INSERT INTO activity_logs(user_id,action) VALUES(5,'SIGN_UP');`);
    assert.deepEqual((await db.query('select id,user_id from billing_accounts where user_id>=4 order by id')).rows,
      [{id:14,user_id:4},{id:15,user_id:5}]);
    assert.deepEqual((await db.query('select user_id,team_id,role from team_members where user_id=5')).rows,
      [{user_id:5,team_id:15,role:'owner'}]);
    await db.exec(contract);
    assert.equal((await db.query('select stripe_customer_id from billing_accounts where user_id=5')).rows[0].stripe_customer_id,'cus_new');
  } finally { await db.close(); }
});

for (const [label, conflict] of [
  ['multiple members', "insert into team_members(user_id,team_id,role) values(2,11,'member')"],
  ['no owner', "update team_members set role='member' where user_id=1"],
  ['orphaned billing', "delete from team_members where user_id=1"],
  ['multiple accounts', "insert into teams(id,name) values(20,'Duplicate'); insert into team_members(user_id,team_id,role) values(1,20,'owner')"],
  ['unresolved invitation', "insert into invitations(team_id,email,role,invited_by) values(11,'pending@example.test','member',1)"],
]) test(`migration refuses ${label} without partial schema changes`, async () => {
  const db = await legacy();
  try {
    await db.exec(conflict);
    await assert.rejects(db.transaction(tx => tx.exec(expand)), /unambiguous/);
    assert.equal((await db.query("select to_regclass('billing_accounts') relation")).rows[0].relation,null);
    assert.equal((await db.query('select count(*)::int n from credit_ledger')).rows[0].n,3);
  } finally { await db.close(); }
});

test('post-contract rollback restores old-release access without losing new accounts or billing writes', async () => {
  const db = await legacy();
  try {
    await db.exec(expand);
    await db.exec(contract);
    await db.exec(`CREATE SCHEMA drizzle;
      CREATE TABLE drizzle.__drizzle_migrations(hash text,created_at bigint);
      INSERT INTO drizzle.__drizzle_migrations VALUES('contract',1793318401000);
      INSERT INTO users(id,email,password_hash) VALUES(4,'after@example.test','hash');
      INSERT INTO billing_accounts(user_id,stripe_customer_id) VALUES(4,'cus_after');
      INSERT INTO activity_logs(user_id,action) VALUES(4,'SIGN_UP');`);
    const before = await snapshot(db);
    const restore = readFileSync(new URL('../../deploy/restore-billing-compat.sql', import.meta.url), 'utf8');
    await db.transaction(tx => tx.exec(restore));
    assert.deepEqual(await snapshot(db), before);
    assert.equal((await db.query('select t.stripe_customer_id from teams t join team_members m on m.team_id=t.id where m.user_id=4')).rows[0].stripe_customer_id,'cus_after');
    await db.exec(`INSERT INTO users(id,email,password_hash) VALUES(5,'rollback@example.test','hash');
      INSERT INTO teams(name) VALUES('During rollback');
      INSERT INTO team_members(user_id,team_id,role) VALUES(5,15,'owner');`);
    await db.exec(contract);
    assert.equal((await db.query('select user_id from billing_accounts where id=15')).rows[0].user_id,5);
  } finally { await db.close(); }
});
