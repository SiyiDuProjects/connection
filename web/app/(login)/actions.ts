'use server';

import { z } from 'zod';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import {
  User,
  users,
  activityLogs,
  billingAccounts,
  type NewUser,
  type NewActivityLog,
  ActivityType,
  friendInviteRedemptions,
  friendInvites,
  emailVerificationTokens,
  extensionApiTokens,
  passwordResetTokens
} from '@/lib/db/schema';
import { comparePasswords, hashPassword, setSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getUser, getBillingAccount } from '@/lib/db/queries';
import { issueEmailVerification, verifyEmailCode, VerificationRateLimitError } from '@/lib/auth/email-verification';
import { requireEmailDelivery } from '@/lib/email/resend';
import { changeAuthenticatedPassword } from '@/lib/auth/password-reset';
import { newPasswordSchema } from '@/lib/auth/password-policy';
import { checkCredentialRateLimit } from '@/lib/auth/rate-limit';
import { safeAuthRedirect } from '@/lib/auth/verification-code';
import { isLocalTestEmail } from '@/lib/auth/local-test-policy';
import {
  validatedAction,
  validatedActionWithUser
} from '@/lib/auth/middleware';

async function logActivity(
  userId: number,
  type: ActivityType,
  ipAddress?: string
) {
  const newActivity: NewActivityLog = {
    userId,
    action: type,
    ipAddress: ipAddress || ''
  };
  await db.insert(activityLogs).values(newActivity);
}

const signInSchema = z.object({
  email: z.string().trim().email().min(3).max(255),
  password: z.string().min(8).max(100)
});

// One credential submission chooses the flow on the server. An existing
// account must always pass signIn's password/deletion/verification checks.
export const authenticate = validatedAction(signInSchema, async (data, formData) => {
  const email = data.email.toLowerCase();
  formData.set('email', email);
  const existing = await db.select({ id: users.id }).from(users)
    .where(eq(users.email, email)).limit(1);
  return existing.length ? signIn({}, formData) : signUp({}, formData);
});

export const signIn = validatedAction(signInSchema, async (data, formData) => {
  const { password } = data;
  const email = data.email.toLowerCase();
  const limited = await checkCredentialRateLimit(email);
  if (limited) return { error: limited, email };

  const [foundUser] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!foundUser) return { error: 'Invalid email or password. Please try again.', email };

  const isPasswordValid = await comparePasswords(
    password,
    foundUser.passwordHash
  );

  if (!isPasswordValid || foundUser.deletedAt) {
    return {
      error: 'Invalid email or password. Please try again.',
      email
    };
  }

  if (!foundUser.emailVerifiedAt) {
    await continueToVerification(foundUser, formData);
  }

  await Promise.all([
    setSession(foundUser),
    logActivity(foundUser.id, ActivityType.SIGN_IN)
  ]);

  const redirectTo = formData.get('redirect') as string | null;
  if (redirectTo === 'checkout') {
    const priceId = formData.get('priceId') as string;
    const { createCheckoutSession } = await import('@/lib/payments/stripe');
    return createCheckoutSession({ account: await getBillingAccount(foundUser.id), priceId });
  }
  if (isInternalRedirect(redirectTo)) {
    redirect(redirectTo);
  }

  redirect('/dashboard');
});

const signUpSchema = z.object({
  email: z.string().email().max(255),
  password: newPasswordSchema,
  ref: z.string().trim().optional()
});

export const signUp = validatedAction(signUpSchema, async (data, formData) => {
  const { password, ref } = data;
  const email = data.email.toLowerCase();
  const localTestAccount = isLocalTestEmail(email);
  const limited = await checkCredentialRateLimit(email, true);
  if (limited) return { error: limited, email, ref };

  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser.length > 0) {
    return {
      error: 'This email already has an account. Sign in instead.',
      email,
      ref
    };
  }

  const passwordHash = await hashPassword(password);
  const friendInviteToken = String(ref || '').replace(/\s+/g, '');
  try { if (!localTestAccount) requireEmailDelivery(); } catch {
    return { error: 'Email verification is temporarily unavailable. Please try again later.', email, ref };
  }

  let createdUser: User;
  try {
    createdUser = await db.transaction(async (tx) => {
      const [friendInvite] = friendInviteToken
        ? await tx
            .select()
            .from(friendInvites)
            .where(eq(friendInvites.token, friendInviteToken))
            .limit(1)
        : [];
      if (friendInviteToken && !friendInvite) {
        throw new Error('INVALID_FRIEND_INVITE');
      }

      const [user] = await tx
        .insert(users)
        .values({
          email,
          passwordHash,
          emailVerifiedAt: localTestAccount ? new Date() : null
        } satisfies NewUser)
        .returning();
      if (!user) throw new Error('USER_CREATION_FAILED');

      await tx.insert(billingAccounts).values({ userId: user.id });

      if (friendInvite && friendInvite.inviterUserId !== user.id) {
        await tx
          .insert(friendInviteRedemptions)
          .values({ inviteId: friendInvite.id, invitedUserId: user.id })
          .onConflictDoNothing({ target: friendInviteRedemptions.invitedUserId });
      }

      await tx.insert(activityLogs).values({
        userId: user.id, action: ActivityType.SIGN_UP, ipAddress: ''
      } satisfies NewActivityLog);
      return user;
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const code = typeof error === 'object' && error && 'code' in error
      ? String(error.code)
      : '';
    if (message === 'INVALID_FRIEND_INVITE') {
      return { error: 'Invalid invite code. Ask your friend for a new code.', email, ref };
    }
    if (code === '23505') {
      return { error: 'This email already has an account. Sign in instead.', email, ref };
    }
    console.error('Sign-up transaction failed:', error);
    return { error: 'Failed to create account. Please try again.', email, ref };
  }

  if (localTestAccount) {
    await setSession(createdUser);
    const destination = formData.get('redirect');
    redirect(typeof destination === 'string' && isInternalRedirect(destination) ? destination : '/dashboard');
  }
  return continueToVerification(createdUser, formData);
});

async function continueToVerification(user: User, formData: FormData): Promise<never> {
  const params = new URLSearchParams({ email: user.email });
  for (const key of ['redirect', 'priceId']) {
    const value = formData.get(key);
    if (typeof value === 'string' && value) params.set(key, value);
  }
  try {
    await issueEmailVerification(user.id, user.email);
    params.set('sent', '1');
  } catch (error) {
    if (error instanceof VerificationRateLimitError) {
      params.set('retryAfter', String(error.retryAfter));
    } else {
      params.set('error', 'delivery');
    }
  }
  redirect(`/verify-email?${params}`);
}

const resendVerificationSchema = z.object({
  email: z.string().email().min(3).max(255)
});

export const resendVerification = validatedAction(
  resendVerificationSchema,
  async (data) => {
    const email = data.email.toLowerCase();
    const [foundUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (foundUser && !foundUser.emailVerifiedAt && !foundUser.deletedAt) {
      try {
        await issueEmailVerification(foundUser.id, email);
      } catch (error) {
        if (error instanceof VerificationRateLimitError) {
          return { error: `Please wait ${error.retryAfter} seconds before requesting another code.`, email, retryAfter: error.retryAfter };
        }
        return { error: 'We could not send your code. Please wait a minute and try again.', email, retryAfter: 60 };
      }
    }
    return { success: 'If this email has an unverified account, a new code is on its way. Check your inbox and spam folder.', email, retryAfter: 60 };
  }
);

export const confirmVerification = validatedAction(
  z.object({ email: z.string().email().max(255), code: z.string().regex(/^\d{6}$/, 'Enter all six digits.') }),
  async ({ email, code }, formData) => {
    let user: User | null;
    try { user = await verifyEmailCode(email.toLowerCase(), code); } catch {
      return { error: 'We could not verify your email. Please try again.', email };
    }
    if (!user) return { error: 'This code is invalid, expired, or has too many attempts. Try again or request a new code.', email };
    await setSession(user);
    if (formData.get('redirect') === 'checkout') {
      const priceId = formData.get('priceId');
      if (typeof priceId === 'string' && priceId) {
        const { createCheckoutSession } = await import('@/lib/payments/stripe');
        return createCheckoutSession({ account: await getBillingAccount(user.id), priceId });
      }
    }
    redirect(safeAuthRedirect(formData.get('redirect')));
  }
);

function isInternalRedirect(value: string | null): value is string {
  return Boolean(value && value.startsWith('/') && safeAuthRedirect(value) === value);
}

export async function signOut() {
  const user = (await getUser()) as User | null;
  if (!user) {
    (await cookies()).delete('session');
    return;
  }

  await db.transaction(async (tx) => {
    // JWTs have no per-device session row. Rotate the account version so every
    // existing web session and extension credential is revoked together.
    // Share the user lock with recovery/token creation, and ignore an old
    // request if another logout or credential change already rotated it.
    const [current] = await tx.select().from(users).where(eq(users.id, user.id)).for('update');
    if (!current || current.deletedAt || current.sessionVersion !== user.sessionVersion) return;
    const now = new Date();
    await tx.update(users).set({ sessionVersion: current.sessionVersion + 1, updatedAt: now })
      .where(eq(users.id, user.id));
    await tx.update(extensionApiTokens).set({ revokedAt: now })
      .where(and(eq(extensionApiTokens.userId, user.id), isNull(extensionApiTokens.revokedAt)));
    await tx.insert(activityLogs).values({ userId: user.id, action: ActivityType.SIGN_OUT, ipAddress: '' });
  });
  (await cookies()).delete('session');
}

const updatePasswordSchema = z.object({
  currentPassword: z.string().min(8).max(100),
  newPassword: newPasswordSchema,
  confirmPassword: z.string().min(8).max(100)
});

export const updatePassword = validatedActionWithUser(
  updatePasswordSchema,
  async (data, _, user) => {
    const { currentPassword, newPassword, confirmPassword } = data;

    const isPasswordValid = await comparePasswords(
      currentPassword,
      user.passwordHash
    );

    if (!isPasswordValid) {
      return {
        error: 'Current password is incorrect.'
      };
    }

    if (currentPassword === newPassword) {
      return {
        error: 'New password must be different from the current password.'
      };
    }

    if (confirmPassword !== newPassword) {
      return {
        error: 'New password and confirmation password do not match.'
      };
    }

    const newPasswordHash = await hashPassword(newPassword);

    const updated = await changeAuthenticatedPassword(user.id, user.passwordHash, newPasswordHash, user.sessionVersion);
    if (!updated) return { error: 'Your password has changed. Please sign in again.' };
    await Promise.all([setSession(updated), logActivity(user.id, ActivityType.UPDATE_PASSWORD)]);

    return {
      success: 'Password updated successfully.'
    };
  }
);

const deleteAccountSchema = z.object({
  password: z.string().min(8).max(100)
});

export const deleteAccount = validatedActionWithUser(
  deleteAccountSchema,
  async (data, _, user) => {
    const { password } = data;

    const isPasswordValid = await comparePasswords(password, user.passwordHash);
    if (!isPasswordValid) {
      return {
        error: 'Incorrect password. Account deletion failed.'
      };
    }


    try {
      const { deleteAccountData } = await import('@/lib/delete-account-data');
      const deleted = await deleteAccountData(user.id,
        { sessionVersion: user.sessionVersion, passwordHash: user.passwordHash }, async () => {
          const account = await getBillingAccount(user.id);
          if (account?.stripeSubscriptionId) {
            const { cancelSubscriptionAtPeriodEnd } = await import('@/lib/payments/stripe');
            await cancelSubscriptionAtPeriodEnd(account.stripeSubscriptionId);
          }
        });
      if (!deleted) return { error: 'Your account credentials have changed. Please sign in again.' };
    } catch {
      return { error: 'Account deletion could not be completed. Please retry or contact support@reachard.co. If you have a subscription, its renewal may already be canceled.' };
    }

    (await cookies()).delete('session');
    redirect('/sign-in');
  }
);

const updateAccountSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address').max(255)
});

export const updateAccount = validatedActionWithUser(
  updateAccountSchema,
  async (data, _, user) => {
    const { name } = data;
    const email = data.email.toLowerCase();
      const emailChanged = email !== user.email;

    if (emailChanged) {
      try { requireEmailDelivery(); } catch {
        return { error: 'Email verification is temporarily unavailable. Your email has not been changed.' };
      }
    }

    const updated = await db.transaction(async (tx) => {
      const [current] = await tx.select().from(users).where(eq(users.id, user.id)).for('update');
      if (!current || current.deletedAt || current.sessionVersion !== user.sessionVersion) return null;
      const now = new Date();
      await tx
        .update(users)
        .set({
          name,
          email,
          emailVerifiedAt: emailChanged ? null : current.emailVerifiedAt,
          sessionVersion: emailChanged ? current.sessionVersion + 1 : current.sessionVersion,
          updatedAt: now
        })
        .where(eq(users.id, user.id));
      if (emailChanged) {
        await tx.update(extensionApiTokens).set({ revokedAt: now })
          .where(eq(extensionApiTokens.userId, user.id));
        await tx.update(emailVerificationTokens).set({ usedAt: now })
          .where(eq(emailVerificationTokens.userId, user.id));
        await tx.update(passwordResetTokens).set({ usedAt: now })
          .where(eq(passwordResetTokens.userId, user.id));
      }
      return { ...current, name, email, emailVerifiedAt: emailChanged ? null : current.emailVerifiedAt,
        sessionVersion: emailChanged ? current.sessionVersion + 1 : current.sessionVersion };
    });
    if (!updated) return { error: 'Your account credentials have changed. Please sign in again.' };
    await logActivity(user.id, ActivityType.UPDATE_ACCOUNT);

    if (emailChanged) {
      (await cookies()).delete('session');
      const destination = new FormData();
      destination.set('redirect', '/dashboard/general');
      return continueToVerification(updated, destination);
    }

    return { name, success: 'Account updated successfully.' };
  }
);
