import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { keepProtocolMessagesTogether } from './local-test-protocol.mjs';

test('production migration CLI uses real Postgres protocol, preserves history, and refuses drift', async () => {
  const db = new PGlite();
  const socket = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 0, maxConnections: 3 });
  keepProtocolMessagesTogether(socket, db);
  try {
    const folder = new URL('../lib/db/migrations/', import.meta.url);
    const journal = JSON.parse(await readFile(new URL('meta/_journal.json', folder), 'utf8')).entries;
    await db.exec('create schema drizzle; create table drizzle.__drizzle_migrations(id serial primary key, hash text not null,created_at bigint)');
    for (const entry of journal.filter(entry => entry.idx <= 20)) {
      const sql = await readFile(new URL(entry.tag + '.sql', folder), 'utf8');
      await db.exec(sql);
      await db.query('insert into drizzle.__drizzle_migrations(hash,created_at) values($1,$2)',
        [createHash('sha256').update(sql).digest('hex'), entry.when]);
    }
    await socket.start();
    const run = (...args) => promisify(execFile)(process.execPath,
      [fileURLToPath(new URL('./migrate-db.mjs', import.meta.url)), ...args],
      { env: { ...process.env, POSTGRES_URL: `postgresql://postgres@127.0.0.1:${socket.port}/postgres` } });
    const initial = JSON.parse((await run('--status')).stdout);
    assert.equal(initial.pending.length,2);
    assert.deepEqual(JSON.parse((await run('--through','0021_personal_billing_accounts')).stdout).applied,['0021_personal_billing_accounts']);
    assert.deepEqual(JSON.parse((await run('--through','0021_personal_billing_accounts')).stdout).applied,[]);
    assert.equal((await db.query("select to_regclass('teams') relation")).rows[0].relation,'teams');
    await run('--through','0022_retire_team_model');
    assert.equal((await db.query("select to_regclass('teams') relation")).rows[0].relation,null);
    await assert.rejects(run('--through','0021_personal_billing_accounts'));
    await db.exec("update drizzle.__drizzle_migrations set hash='drift' where created_at=1793318401000");
    await assert.rejects(run('--status'), error => {
      assert.match(error.stderr,/validation_failed/);
      assert.doesNotMatch(error.stderr,/postgresql:|127\.0\.0\.1|select|drift/);
      return true;
    });
  } finally {
    for (const handler of socket.handlers.values()) await handler.detach(true);
    await socket.stop();
    await db.close();
  }
});
