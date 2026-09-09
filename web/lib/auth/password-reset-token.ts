import { createHash, randomBytes } from 'node:crypto';

export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000;
export const PASSWORD_RESET_COOLDOWN_MS = 60 * 1000;
export const PASSWORD_RESET_MAX_PER_HOUR = 5;

export function newPasswordResetToken() {
  return randomBytes(32).toString('base64url');
}

export function isPasswordResetToken(token: unknown): token is string {
  return typeof token === 'string' && /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function hashPasswordResetToken(token: string) {
  return createHash('sha256').update(`password-reset:${token}`).digest('hex');
}

export function passwordResetUrl(token: string) {
  if (!isPasswordResetToken(token)) throw new Error('Invalid password reset token.');
  const configured = process.env.BASE_URL?.trim() || 'https://reachard.co';
  const base = new URL(configured);
  const local = process.env.NODE_ENV !== 'production'
    && ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname);
  if (base.username || base.password || base.search || base.hash
    || (base.protocol !== 'https:' && !(local && base.protocol === 'http:'))
    || (!local && !['reachard.co', 'www.reachard.co'].includes(base.hostname))) {
    throw new Error('Password reset origin is not configured securely.');
  }
  const url = new URL('/reset-password', base.origin);
  url.searchParams.set('token', token);
  return url.href;
}
