// Explicit staged migration runner. Credentials come from the process only;
// output contains migration names and SQLSTATE, never SQL, URLs or row values.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import postgres from 'postgres';

const args = process.argv.slice(2);
const statusOnly = args.length === 1 && args[0] === '--status';
if (!statusOnly && !(args.length === 2 && args[0] === '--through')) {
  throw new Error('Use --status or --through EXACT_MIGRATION_TAG');
}
if (!process.env.POSTGRES_URL) throw new Error('POSTGRES_URL is required');
const folder = new URL('../lib/db/migrations/', import.meta.url);
const journal = JSON.parse(await readFile(new URL('meta/_journal.json', folder), 'utf8')).entries;
const migrations = await Promise.all(journal.map(async entry => {
  const sql = await readFile(new URL(`${entry.tag}.sql`, folder), 'utf8');
  const hash = value => createHash('sha256').update(value).digest('hex');
  // Historical Drizzle runs on Windows and macOS hashed different line endings.
  // Accept only the same SQL bytes with LF/CRLF conversion, never arbitrary drift.
  const lf = sql.replace(/\r\n/g, '\n');
  return { ...entry, sql, hash: hash(sql), hashes: [hash(sql), hash(lf), hash(lf.replace(/\n/g, '\r\n'))] };
}));
const through = statusOnly ? Infinity : migrations.find(entry => entry.tag === args[1])?.when;
if (!through) throw new Error('Unknown migration target');
const db = postgres(process.env.POSTGRES_URL, { max: 1, onnotice: () => {} });
try {
  await db.begin(async tx => {
    await tx`select pg_advisory_xact_lock(9127648021::bigint)`;
    await tx`set local lock_timeout = '10s'`;
    await tx`set local statement_timeout = '60s'`;
    const applied = await tx`select hash,created_at from drizzle.__drizzle_migrations order by created_at`;
    for (const entry of applied) {
      if (!migrations.some(m => m.when === Number(entry.created_at) && m.hashes.includes(entry.hash))) {
        throw new Error('Database migration history does not match this checkout');
      }
    }
    const latest = Number(applied.at(-1)?.created_at || 0);
    if (!statusOnly && latest > through) throw new Error('Database is already beyond the requested target');
    const pending = migrations.filter(entry => entry.when > latest && entry.when <= through);
    if (statusOnly) {
      console.log(JSON.stringify({ applied: applied.length, pending: pending.map(entry => entry.tag) }));
      return;
    }
    for (const entry of pending) {
      await tx.unsafe(entry.sql);
      await tx`insert into drizzle.__drizzle_migrations(hash,created_at) values(${entry.hash},${entry.when})`;
    }
    // Emit success only after the transaction commits below.
    return pending.map(entry => entry.tag);
  }).then(applied => { if (applied) console.log(JSON.stringify({ applied })); });
} catch (error) {
  console.error(JSON.stringify({ migrationFailed: true, sqlState: error.code || 'validation_failed' }));
  process.exitCode = 1;
} finally { await db.end(); }
