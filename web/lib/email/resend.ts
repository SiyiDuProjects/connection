import 'server-only';
import { verificationEmail } from './verification-template';

export function requireEmailDelivery() {
  if (!process.env.RESEND_API_KEY?.trim() || !process.env.EMAIL_FROM?.trim()) {
    throw new Error('Email delivery is not configured.');
  }
  if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) {
    throw new Error('AUTH_SECRET must contain at least 32 characters.');
  }
}

export async function sendVerificationEmail(email: string, code: string, deliveryId: string) {
  requireEmailDelivery();
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `email-verification/${deliveryId}`,
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM!.trim(), to: [email],
      reply_to: 'support@reachard.co', ...verificationEmail(code),
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
