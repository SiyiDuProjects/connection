import { PGlite } from '@electric-sql/pglite';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import net from 'node:net';
import dotenv from 'dotenv';
import { keepProtocolMessagesTogether } from './local-test-protocol.mjs';

const require = createRequire(import.meta.url);
const web = fileURLToPath(new URL('..', import.meta.url));
const root = path.dirname(web);
// A fresh in-memory database on every start; never inherits a production secret.
for (const port of [3000, 8787, 55432]) await new Promise((resolve, reject) => {
  const probe = net.createServer();
  probe.once('error', () => reject(new Error(`Port ${port} is already in use. Stop that local service first.`)));
  probe.listen(port, '127.0.0.1', () => probe.close(resolve));
});
const env = { ...process.env };
for (const folder of [web, path.join(root, 'server')]) for (const file of ['.env', '.env.local', '.env.development', '.env.development.local']) {
  const content = await readFile(path.join(folder, file), 'utf8').catch(() => '');
  for (const key of Object.keys(dotenv.parse(content))) env[key] = '';
}
Object.assign(env, {
  NODE_ENV: 'development', REACHARD_LOCAL_TEST: '1', VERCEL: '',
  POSTGRES_URL: 'postgresql://postgres@127.0.0.1:55432/postgres',
  AUTH_SECRET: randomBytes(48).toString('hex'), BASE_URL: 'http://127.0.0.1:3000',
  WEB_BASE_URL: 'http://127.0.0.1:3000', NEXT_PUBLIC_API_BASE_URL: 'http://127.0.0.1:8787',
  REACHARD_PREVIEW_DIST_DIR: '.next-local-test', HOST: '127.0.0.1', PORT: '8787',
  CONTACT_PROVIDER: 'mock', APOLLO_MOCK: 'true', OPENAI_API_KEY: '', TREG_TOKEN: '',
  RESEND_API_KEY: '', EMAIL_FROM: '', STRIPE_SECRET_KEY: 'sk_test_local_disabled',
  EXTENSION_ID: '', CHROME_EXTENSION_ID: '', ALLOWED_EXTENSION_IDS: '',
  ALLOW_ANY_EXTENSION_ID: 'true', ALLOWED_ORIGINS: 'http://127.0.0.1:3000,http://localhost:3000',
  CONTACT_SEARCH_CREDITS: '0', CONTACT_REVEAL_CREDITS: '1', EMAIL_DRAFT_CREDITS: '0',
});
const db = await PGlite.create();
const migrations = path.join(web, 'lib/db/migrations');
const journal = JSON.parse(await readFile(path.join(migrations, 'meta/_journal.json'), 'utf8'));
for (const entry of journal.entries) await db.exec(await readFile(path.join(migrations, `${entry.tag}.sql`), 'utf8'));
const socket = new PGLiteSocketServer({ db, host: '127.0.0.1', port: 55432, maxConnections: 20 });
keepProtocolMessagesTogether(socket, db);
await socket.start();
const children = [
  spawn(process.execPath, ['src/index.js'], { cwd: path.join(root, 'server'), env, stdio: 'inherit' }),
  spawn(process.execPath, [require.resolve('next/dist/bin/next'), 'dev', '--hostname', '127.0.0.1', '--port', '3000'], { cwd: web, env, stdio: 'inherit' }),
];
console.log('Reachard local test: http://127.0.0.1:3000/sign-up');
console.log('Use any @reachard.test email and your own test password. Restart registration clears only the current local test account.');
let closing = false;
async function shutdown() {
  if (closing) return; closing = true;
  for (const child of children) child.kill();
  await socket.stop(); await db.close(); process.exit(0);
}
for (const child of children) child.on('exit', () => void shutdown());
process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
