import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';

export const CODE_TTL_MS = 10 * 60 * 1000;
export const RESEND_COOLDOWN_MS = 60 * 1000;
export const MAX_CODE_ATTEMPTS = 5;
export const MAX_SENDS_PER_HOUR = 5;

export function generateVerificationCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function hashVerificationCode(userId: number, nonce: string, code: string, secret: string) {
  if (secret.length < 32) throw new Error('Verification secret is not configured.');
  return createHmac('sha256', secret).update(`${userId}:${nonce}:${code}`).digest('hex');
}

export function matchesVerificationCode(expected: string, actual: string) {
  if (!/^[a-f0-9]{64}$/.test(expected) || !/^[a-f0-9]{64}$/.test(actual)) return false;
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(actual, 'hex'));
}

export function safeAuthRedirect(value: unknown) {
  if (typeof value !== 'string' || !value.startsWith('/') || /[\\\x00-\x20]/.test(value)) return '/dashboard';
  const base = 'https://reachard.co';
  try {
    const url = new URL(value, base);
    return url.origin === base ? `${url.pathname}${url.search}${url.hash}` : '/dashboard';
  } catch { return '/dashboard'; }
}
