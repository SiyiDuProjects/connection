import postgres from 'postgres';

// One pool shared by route bundles, account transactions and provider budgets.
const key = Symbol.for('reachard.postgres');
export function getDatabaseClient() {
  const url = process.env.POSTGRES_URL;
  if (!url) return null;
  const current = globalThis[key];
  if (current) {
    if (current.url !== url) throw new Error('Database configuration changed inside a running process.');
    return current.client;
  }
  const local = process.env.REACHARD_LOCAL_TEST === '1' && process.env.NODE_ENV === 'development';
  const client = postgres(url, { max: local ? 1 : 10, connect_timeout: 10, ...(local ? {prepare:false} : {}) });
  globalThis[key] = {url, client};
  return client;
}
