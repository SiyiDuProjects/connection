import 'server-only';
import { verificationEmail } from './verification-template';
import { passwordChangedEmail, passwordResetEmail } from './password-reset-template';
import { BRAND_NAME } from '@/lib/brand';
import { reserveAccountEmailDelivery } from '@/lib/auth/rate-limit';

export function requireEmailDelivery() {
  if (!process.env.RESEND_API_KEY?.trim() || !process.env.EMAIL_FROM?.trim()) {
    throw new Error('Email delivery is not configured.');
  }
  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
    throw new Error('AUTH_SECRET must contain at least 32 characters.');
  }
}

export async function sendVerificationEmail(email: string, code: string, deliveryId: string) {
  return sendAccountEmail(email, verificationEmail(code), `email-verification/${deliveryId}`);
}

export async function sendPasswordResetEmail(email: string, resetUrl: string, deliveryId: string) {
  return sendAccountEmail(email, passwordResetEmail(resetUrl), `password-reset/${deliveryId}`);
}

export async function sendPasswordChangedEmail(email: string, deliveryId: string) {
  return sendAccountEmail(email, passwordChangedEmail(), `password-changed/${deliveryId}`);
}

export function accountEmailSender() {
  const configured = process.env.EMAIL_FROM?.trim() || '';
  const address = (configured.match(/<([^<>]+)>$/)?.[1] || configured).trim();
  if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(address) || /[\r\n]/.test(configured)) {
    throw new Error('Email sender is not configured correctly.');
  }
  // Only the deliverable address belongs to environment configuration. The
  // display name always follows the shared brand, even after a later rename.
  return `"${BRAND_NAME.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/[\r\n]/g, '')}" <${address}>`;
}

async function sendAccountEmail(email: string, content: { subject: string; text: string; html: string }, deliveryId: string) {
  requireEmailDelivery();
  await reserveAccountEmailDelivery();
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': deliveryId,
    },
    body: JSON.stringify({
      from: accountEmailSender(), to: [email],
      reply_to: 'support@reachard.co', ...content,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Email delivery failed with status ${response.status}.`);
  const result: unknown = await response.json();
  if (!result || typeof result !== 'object' || !('id' in result) || typeof result.id !== 'string' || !result.id) {
    throw new Error('Email delivery returned no message ID.');
  }
  return result.id;
}
