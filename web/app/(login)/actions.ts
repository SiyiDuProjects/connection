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
  userSettings
} from '@/lib/db/schema';
import { comparePasswords, hashPassword, setSession } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import {
  cancelSubscriptionAtPeriodEnd,
  createCheckoutSession
} from '@/lib/payments/stripe';
import { getUser, getUserWithTeam } from '@/lib/db/queries';
import { revokeExtensionTokens } from '@/lib/extension-tokens';
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
  email: z.string().email().min(3).max(255),
  password: z.string().min(8).max(100)
});

const accountStatusSchema = z.object({
  email: z.string().email().min(3).max(255)
});

export async function checkAccountStatus(emailInput: string) {
  const result = accountStatusSchema.safeParse({ email: emailInput });
  if (!result.success) {
    return { error: result.error.errors[0].message };
  }

  const email = result.data.email.toLowerCase();
  const existingUser = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  return {
    email,
    exists: existingUser.length > 0
  };
}

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

  if (!isPasswordValid) {
    return {
      error: 'Invalid email or password. Please try again.',
      email
    };
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
    return createCheckoutSession({ team: foundTeam, priceId });
  }
  if (isInternalRedirect(redirectTo)) {
    redirect(redirectTo);
  }

  redirect('/dashboard');
});

const signUpSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
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
          emailVerifiedAt: new Date(),
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

  await setSession(createdUser);

  const redirectTo = formData.get('redirect') as string | null;
  if (isInternalRedirect(redirectTo)) {
    redirect(redirectTo);
  }

  redirect('/dashboard');
});

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

    return {
      success: 'Email verification is currently disabled.',
      email
    };
  }
);

function isInternalRedirect(value: string | null): value is string {
  return Boolean(value && value.startsWith('/') && !value.startsWith('//'));
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
  newPassword: z.string().min(8).max(100),
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

    await Promise.all([
      db
        .update(users)
        .set({ passwordHash: newPasswordHash })
        .where(eq(users.id, user.id)),
      logActivity(userWithTeam?.teamId, user.id, ActivityType.UPDATE_PASSWORD)
    ]);

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

    if (userWithTeam?.teamRole === 'owner' && userWithTeam.stripeSubscriptionId) {
      await cancelSubscriptionAtPeriodEnd(userWithTeam.stripeSubscriptionId);
    }

    await revokeExtensionTokens(user.id);

    await logActivity(
      userWithTeam?.teamId,
      user.id,
      ActivityType.DELETE_ACCOUNT
    );

    await Promise.all([
      db.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, user.id)),
      db.delete(userSettings).where(eq(userSettings.userId, user.id))
    ]);

    // Soft delete
    await db
      .update(users)
      .set({
        deletedAt: sql`CURRENT_TIMESTAMP`,
        email: sql`CONCAT(email, '-', id, '-deleted')` // Ensure email uniqueness
      })
      .where(eq(users.id, user.id));

    if (userWithTeam?.teamId) {
      await db
        .delete(teamMembers)
        .where(
          and(
            eq(teamMembers.userId, user.id),
            eq(teamMembers.teamId, userWithTeam.teamId)
          )
        );
    }

    (await cookies()).delete('session');
    redirect('/sign-in');
  }
);

const updateAccountSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Invalid email address')
});

export const updateAccount = validatedActionWithUser(
  updateAccountSchema,
  async (data, _, user) => {
    const { name } = data;
    const email = data.email.toLowerCase();
    const userWithTeam = await getUserWithTeam(user.id);
    const emailChanged = email !== user.email;

    await Promise.all([
      db
        .update(users)
        .set({
          name,
          email,
          emailVerifiedAt: emailChanged ? new Date() : user.emailVerifiedAt,
          updatedAt: new Date()
        })
        .where(eq(users.id, user.id)),
      logActivity(userWithTeam?.teamId, user.id, ActivityType.UPDATE_ACCOUNT)
    ]);

    if (emailChanged) {
      await setSession({ ...user, email, emailVerifiedAt: new Date() });
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
