import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import ts from 'typescript';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';

const root = fileURLToPath(new URL('..', import.meta.url));
const pg = new PGlite();
await pg.exec(readFileSync(resolve(root, 'lib/db/migrations/0018_auth_rate_limits.sql'), 'utf8'));
const database = drizzle(pg);
const require = createRequire(import.meta.url);
let incoming = new Headers();
let unavailable = false;
const secret = 'auth-rate-limits-test-only-secret-32-characters';
const overrides = {
  'server-only': {},
  'next/headers': { headers: async () => incoming },
  '@/lib/db/drizzle': { db: { execute: async query => {
    if (unavailable) throw new Error('fixture database outage');
    return (await database.execute(query)).rows;
  } } },
};
const module = { exports: {} };
const source = ts.transpileModule(readFileSync(resolve(root, 'lib/auth/rate-limit.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
new Function('require','module','exports',source)(name => overrides[name] || require(name), module, module.exports);
const { consumeAuthLimit, checkCredentialRateLimit, reserveAccountEmailDelivery } = module.exports;
beforeEach(async () => {
  await pg.exec('truncate auth_rate_limits');
  process.env.AUTH_SECRET = secret;
  delete process.env.VERCEL;
  incoming = new Headers(); unavailable = false;
});
after(() => pg.close());

test('simultaneous requests across calls cannot exceed the persistent account limit', async () => {
  const outcomes = await Promise.all(Array.from({length:25}, () => consumeAuthLimit('login','user@example.com',10,900)));
  assert.equal(outcomes.filter(value => value === 0).length, 10);
  assert.ok(outcomes.filter(Boolean).every(value => value > 0 && value <= 900));
  assert.ok(await consumeAuthLimit('login','user@example.com',10,900) > 0);
  const rows = (await pg.query('select * from auth_rate_limits')).rows;
  assert.equal(rows.length, 1);
  assert.ok(!rows[0].key.includes('user@example.com'));
  assert.equal(await consumeAuthLimit('login','another@example.com',10,900),0);
});

test('expired windows reset without manually clearing the database', async () => {
  await consumeAuthLimit('login','account',1,900);
  assert.ok(await consumeAuthLimit('login','account',1,900) > 0);
  await pg.exec("update auth_rate_limits set resets_at=now()-interval '1 second'");
  assert.equal(await consumeAuthLimit('login','account',1,900),0);
});

test('spoofed forwarding headers cannot evade the signup limit outside the trusted host', async () => {
  for (let i=0; i<10; i++) {
    incoming = new Headers({'x-forwarded-for':`192.0.2.${i}`});
    assert.equal(await checkCredentialRateLimit(`person${i}@example.com`,true),null);
  }
  incoming = new Headers({'x-forwarded-for':'203.0.113.10'});
  assert.match(await checkCredentialRateLimit('one-more@example.com',true), /Too many attempts/);
});

test('a shared email limit blocks password guessing across distinct trusted-edge IPs', async () => {
  process.env.VERCEL='1';
  for (let i=0; i<10; i++) {
    incoming = new Headers({'x-vercel-forwarded-for':`192.0.2.${i}`});
    assert.equal(await checkCredentialRateLimit('TARGET@example.com'),null);
  }
  incoming = new Headers({'x-vercel-forwarded-for':'203.0.113.10'});
  assert.match(await checkCredentialRateLimit('target@example.com'), /Too many attempts/);
});

test('account mail has a global hourly and daily ceiling across recipients', async () => {
  for (let i=0;i<50;i++) await reserveAccountEmailDelivery();
  await assert.rejects(reserveAccountEmailDelivery, /rate limited/);
  await pg.exec("update auth_rate_limits set resets_at=now()-interval '1 second' where key like 'account-mail-hour:%'");
  for (let i=0;i<40;i++) await reserveAccountEmailDelivery();
  await assert.rejects(reserveAccountEmailDelivery, /rate limited/);
});

test('database or signing-secret failures do not silently disable the protection', async () => {
  unavailable=true;
  await assert.rejects(() => checkCredentialRateLimit('user@example.com'));
  unavailable=false; process.env.AUTH_SECRET='';
  await assert.rejects(() => checkCredentialRateLimit('user@example.com'), /unavailable/);
});
