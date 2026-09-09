import 'server-only';
import { createHmac } from 'node:crypto';
import { headers } from 'next/headers';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';

export async function consumeAuthLimit(scope: string, identity: string, maximum: number, seconds: number) {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error('Authentication protection is unavailable.');
  // Neither account addresses nor client IPs are retained in the rate-limit table.
  const digest = createHmac('sha256', secret).update(`${scope}:${identity}`).digest('hex');
  const rows = await db.execute(sql`select consume_auth_rate_limit(${scope + ':' + digest}, ${maximum}::integer, ${seconds}::integer) as retry_after`);
  const retryAfter = Number(rows[0]?.retry_after);
  if (!Number.isSafeInteger(retryAfter) || retryAfter < 0) throw new Error('Authentication protection is unavailable.');
  return retryAfter;
}

export async function checkCredentialRateLimit(email: string, signup = false) {
  const requestHeaders = await headers();
  // Vercel overwrites this request header at its trusted edge. On other hosts
  // do not trust caller-supplied forwarding headers; use the shared fallback.
  const ip = process.env.VERCEL === '1'
    ? (requestHeaders.get('x-vercel-forwarded-for') || requestHeaders.get('x-forwarded-for') || 'unknown').split(',')[0].trim()
    : 'non-vercel';
  const perIp = await consumeAuthLimit(signup ? 'signup-ip' : 'login-ip', ip, signup ? 10 : 60, signup ? 3600 : 900);
  if (perIp) return 'Too many attempts. Please wait before trying again.';
  const perAccount = await consumeAuthLimit('credentials-email', email.trim().toLowerCase(), 10, 900);
  return perAccount ? 'Too many attempts. Please wait before trying again.' : null;
}

export async function reserveAccountEmailDelivery() {
  // Shared across instances and recipients so sign-up spam cannot exhaust the
  // account-mail provider without an explicit application ceiling.
  if (await consumeAuthLimit('account-mail-hour', 'all', 50, 3600)
    || await consumeAuthLimit('account-mail-day', 'all', 90, 86400)) {
    throw new Error('Account email is temporarily rate limited.');
  }
}
