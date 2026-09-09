'use server';

import { z } from 'zod';
import { after } from 'next/server';
import { cookies } from 'next/headers';
import type { ActionState } from '@/lib/auth/middleware';
import { issuePasswordReset, resetPassword } from '@/lib/auth/password-reset';
import { newPasswordSchema } from '@/lib/auth/password-policy';
import { requireEmailDelivery, sendPasswordChangedEmail } from '@/lib/email/resend';

const emailSchema = z.string().trim().email().max(255).transform(value => value.toLowerCase());
const resetSchema = z.object({
  token: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  password: newPasswordSchema,
  confirmPassword: z.string().min(8).max(100),
});

export async function requestPasswordReset(_previous: ActionState, data: FormData): Promise<ActionState> {
  const parsed = emailSchema.safeParse(data.get('email'));
  if (!parsed.success) return { error: 'Enter a valid email address.' };
  try { requireEmailDelivery(); } catch {
    return { error: 'Password recovery is temporarily unavailable. Please try again later or contact support@reachard.co.' };
  }
  // Next keeps this work alive after the response in serverless deployments.
  // Existing, missing, deleted and rate-limited accounts have identical public
  // responses and do not wait on database lookups or email delivery.
  after(async () => {
    try { await issuePasswordReset(parsed.data); } catch {
      console.error('Password recovery request could not be completed.');
    }
  });
  return { success: 'If an account matches that address, you will receive a password reset link. Check your inbox and spam folder.' };
}

export async function confirmPasswordReset(_previous: ActionState, data: FormData): Promise<ActionState> {
  const parsed = resetSchema.safeParse(Object.fromEntries(data));
  if (!parsed.success) return { error: parsed.error.errors[0]?.message || 'Use a valid reset link and a password with at least 8 characters.' };
  if (parsed.data.password !== parsed.data.confirmPassword) return { error: 'Your passwords do not match.' };
  const result = await resetPassword(parsed.data.token, parsed.data.password);
  if (!result) return { error: 'This reset link is invalid or has expired. Request a new link.', invalidLink: true };
  (await cookies()).delete('session');
  after(async () => {
    try { await sendPasswordChangedEmail(result.email, result.deliveryId); } catch {
      console.error('Password change notification could not be delivered.');
    }
  });
  return { success: 'Your password is updated. Sign in again with your new password.' };
}
