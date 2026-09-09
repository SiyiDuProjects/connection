'use server';

import { z } from 'zod';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import {
  User,
  users,
  teams,
  teamMembers,
  activityLogs,
  type NewUser,
  type NewTeam,
  type NewTeamMember,
  type NewActivityLog,
  ActivityType,
  friendInviteRedemptions,
  friendInvites,
  invitations,
  emailVerificationTokens,
  extensionApiTokens,
  passwordResetTokens,
  userSettings
} from '@/lib/db/schema';
import { comparePasswords, hashPassword, setSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import { revokeExtensionTokens } from '@/lib/extension-tokens';
import { issueEmailVerification, verifyEmailCode, VerificationRateLimitError } from '@/lib/auth/email-verification';
import { requireEmailDelivery } from '@/lib/email/resend';
import { changeAuthenticatedPassword } from '@/lib/auth/password-reset';
import { newPasswordSchema } from '@/lib/auth/password-policy';
import { safeAuthRedirect } from '@/lib/auth/verification-code';
import {
  validatedAction,
  validatedActionWithUser
} from '@/lib/auth/middleware';

async function logActivity(
  teamId: number | null | undefined,
  userId: number,
  type: ActivityType,
  ipAddress?: string
) {
  if (teamId === null || teamId === undefined) {
    return;
  }
  const newActivity: NewActivityLog = {
    teamId,
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

  const userWithTeam = await db
    .select({
      user: users,
      team: teams,
      teamRole: teamMembers.role
    })
    .from(users)
    .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
    .leftJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(eq(users.email, email))
    .limit(1);

  if (userWithTeam.length === 0) {
    return {
      error: 'Invalid email or password. Please try again.',
      email
    };
  }

  const { user: foundUser, team: foundTeam, teamRole } = userWithTeam[0];

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
    logActivity(foundTeam?.id, foundUser.id, ActivityType.SIGN_IN)
  ]);

  const redirectTo = formData.get('redirect') as string | null;
  if (redirectTo === 'checkout') {
    if (teamRole !== 'owner') {
      redirect('/dashboard');
    }
    const priceId = formData.get('priceId') as string;
    const { createCheckoutSession } = await import('@/lib/payments/stripe');
    return createCheckoutSession({ team: foundTeam, priceId });
  }
  if (isInternalRedirect(redirectTo)) {
    redirect(redirectTo);
  }

  redirect('/dashboard');
});

const signUpSchema = z.object({
  email: z.string().email().max(255),
  password: newPasswordSchema,
  inviteId: z.string().optional(),
  ref: z.string().trim().optional()
});

export const signUp = validatedAction(signUpSchema, async (data, formData) => {
  const { password, inviteId, ref } = data;
  const email = data.email.toLowerCase();

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
  const parsedInviteId = inviteId ? Number.parseInt(inviteId, 10) : null;
  if (inviteId && (!Number.isSafeInteger(parsedInviteId) || Number(parsedInviteId) <= 0)) {
    return { error: 'Invalid or expired invitation.', email, ref };
  }

  try { requireEmailDelivery(); } catch {
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

      let teamId: number;
      let userRole = 'owner';

      if (parsedInviteId) {
        const [invitation] = await tx
          .update(invitations)
          .set({ status: 'accepted' })
          .where(
            and(
              eq(invitations.id, parsedInviteId),
              eq(invitations.email, email),
              eq(invitations.status, 'pending')
            )
          )
          .returning();
        if (!invitation) throw new Error('INVALID_TEAM_INVITATION');
        teamId = invitation.teamId;
        userRole = invitation.role;
      } else {
        const [team] = await tx
          .insert(teams)
          .values({ name: `${email}'s Team` } satisfies NewTeam)
          .returning();
        if (!team) throw new Error('TEAM_CREATION_FAILED');
        teamId = team.id;
      }

      const [user] = await tx
        .insert(users)
        .values({
          email,
          passwordHash,
          emailVerifiedAt: null,
          role: userRole
        } satisfies NewUser)
        .returning();
      if (!user) throw new Error('USER_CREATION_FAILED');

      await tx.insert(teamMembers).values({
        userId: user.id,
        teamId,
        role: userRole
      } satisfies NewTeamMember);

      if (friendInvite && friendInvite.inviterUserId !== user.id) {
        await tx
          .insert(friendInviteRedemptions)
          .values({ inviteId: friendInvite.id, invitedUserId: user.id })
          .onConflictDoNothing({ target: friendInviteRedemptions.invitedUserId });
      }

      const activityTypes = [
        parsedInviteId ? ActivityType.ACCEPT_INVITATION : ActivityType.CREATE_TEAM,
        ActivityType.SIGN_UP
      ];
      await tx.insert(activityLogs).values(
        activityTypes.map((type) => ({
          teamId,
          userId: user.id,
          action: type,
          ipAddress: ''
        } satisfies NewActivityLog))
      );
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
    if (message === 'INVALID_TEAM_INVITATION') {
      return { error: 'Invalid or expired invitation.', email, ref };
    }
    if (code === '23505') {
      return { error: 'This email already has an account. Sign in instead.', email, ref };
    }
    console.error('Sign-up transaction failed:', error);
    return { error: 'Failed to create account. Please try again.', email, ref };
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
      const [membership] = await db.select({ team: teams, role: teamMembers.role }).from(teamMembers)
        .innerJoin(teams, eq(teams.id, teamMembers.teamId)).where(eq(teamMembers.userId, user.id)).limit(1);
      const priceId = formData.get('priceId');
      if (membership?.role === 'owner' && typeof priceId === 'string' && priceId) {
        const { createCheckoutSession } = await import('@/lib/payments/stripe');
        return createCheckoutSession({ team: membership.team, priceId });
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

  const userWithTeam = await getUserWithTeam(user.id);
  await Promise.all([
    revokeExtensionTokens(user.id),
    logActivity(userWithTeam?.teamId, user.id, ActivityType.SIGN_OUT)
  ]);
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
    const userWithTeam = await getUserWithTeam(user.id);

    const updated = await changeAuthenticatedPassword(user.id, user.passwordHash, newPasswordHash, user.sessionVersion);
    if (!updated) return { error: 'Your password has changed. Please sign in again.' };
    await Promise.all([setSession(updated), logActivity(userWithTeam?.teamId, user.id, ActivityType.UPDATE_PASSWORD)]);

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

    const userWithTeam = await getUserWithTeam(user.id);

    try {
      const { deleteAccountData } = await import('@/lib/delete-account-data');
      const deleted = await deleteAccountData(user.id, userWithTeam?.teamId,
        { sessionVersion: user.sessionVersion, passwordHash: user.passwordHash }, async () => {
          if (userWithTeam?.teamRole === 'owner' && userWithTeam.stripeSubscriptionId) {
            const { cancelSubscriptionAtPeriodEnd } = await import('@/lib/payments/stripe');
            await cancelSubscriptionAtPeriodEnd(userWithTeam.stripeSubscriptionId);
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
    const userWithTeam = await getUserWithTeam(user.id);
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
    await logActivity(userWithTeam?.teamId, user.id, ActivityType.UPDATE_ACCOUNT);

    if (emailChanged) {
      (await cookies()).delete('session');
      const destination = new FormData();
      destination.set('redirect', '/dashboard/general');
      return continueToVerification(updated, destination);
    }

    return { name, success: 'Account updated successfully.' };
  }
);

const removeTeamMemberSchema = z.object({
  memberId: z.coerce.number().int().positive()
});

export const removeTeamMember = validatedActionWithUser(
  removeTeamMemberSchema,
  async (data, _, user) => {
    const { memberId } = data;
    const userWithTeam = await getUserWithTeam(user.id);

    if (!userWithTeam?.teamId) {
      return { error: 'User is not part of a team' };
    }

    if (userWithTeam.teamRole !== 'owner') {
      return { error: 'Only team owners can remove members' };
    }

    const [member] = await db
      .select({ userId: teamMembers.userId })
      .from(teamMembers)
      .where(
        and(
          eq(teamMembers.id, memberId),
          eq(teamMembers.teamId, userWithTeam.teamId)
        )
      )
      .limit(1);

    if (!member) {
      return { error: 'Team member not found' };
    }

    if (member.userId === user.id) {
      return { error: 'Owners cannot remove themselves' };
    }

    await db
      .delete(teamMembers)
      .where(
        and(
          eq(teamMembers.id, memberId),
          eq(teamMembers.teamId, userWithTeam.teamId)
        )
      );

    await logActivity(
      userWithTeam.teamId,
      user.id,
      ActivityType.REMOVE_TEAM_MEMBER
    );

    return { success: 'Team member removed successfully' };
  }
);

const inviteTeamMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  role: z.enum(['member', 'owner'])
});

export const inviteTeamMember = validatedActionWithUser(
  inviteTeamMemberSchema,
  async (data, _, user) => {
    void data;
    const userWithTeam = await getUserWithTeam(user.id);

    if (!userWithTeam?.teamId) {
      return { error: 'User is not part of a team' };
    }

    if (userWithTeam.teamRole !== 'owner') {
      return { error: 'Only team owners can invite members' };
    }
    return {
      error: 'Team invitations are unavailable until verified email delivery is configured.'
    };
  }
);
