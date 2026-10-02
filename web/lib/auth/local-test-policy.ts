// This switch cannot activate on a deployment or against a remote database.
export function localTestEnabled(env: NodeJS.ProcessEnv = process.env) {
  if (env.NODE_ENV !== 'development' || env.REACHARD_LOCAL_TEST !== '1' || env.VERCEL) return false;
  try {
    const database = new URL(env.POSTGRES_URL || '');
    return database.hostname === '127.0.0.1' && database.port === '55432' && database.pathname === '/postgres';
  } catch { return false; }
}

export function isLocalTestEmail(email: string, env: NodeJS.ProcessEnv = process.env) {
  return localTestEnabled(env) && /^[a-z0-9._+-]+@reachard\.test$/i.test(email);
}
