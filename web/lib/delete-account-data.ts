import 'server-only';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { activityLogs, ActivityType, apiIdempotencyKeys, emailVerificationTokens, extensionApiTokens, passwordResetTokens, teamMembers, users, userSettings } from '@/lib/db/schema';

// Recheck the credential under the same user lock as password recovery before
// billing cancellation. Local deletion steps then commit or roll back together.
export async function deleteAccountData(userId: number, teamId: number | null | undefined,
  expected: { sessionVersion: number; passwordHash: string }, beforeDelete?: () => Promise<void>) {
  return db.transaction(async tx => {
    const [user] = await tx.select().from(users).where(eq(users.id, userId)).for('update');
    if (!user) return false;
    if (user.deletedAt) return true;
    if (user.sessionVersion !== expected.sessionVersion || user.passwordHash !== expected.passwordHash) return false;
    if (beforeDelete) await beforeDelete();
    const now = new Date();
    await tx.update(extensionApiTokens).set({ revokedAt: now }).where(eq(extensionApiTokens.userId, userId));
    await tx.delete(emailVerificationTokens).where(eq(emailVerificationTokens.userId, userId));
    await tx.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
    await tx.delete(userSettings).where(eq(userSettings.userId, userId));
    await tx.delete(apiIdempotencyKeys).where(eq(apiIdempotencyKeys.userId, userId));
    if (teamId != null) await tx.insert(activityLogs).values({ teamId, userId, action: ActivityType.DELETE_ACCOUNT, ipAddress: '' });
    await tx.update(users).set({
      deletedAt: now, updatedAt: now, name: null, emailVerifiedAt: null,
      email: `deleted-${userId}-${randomUUID()}@deleted.invalid`, passwordHash: '!deleted-account'
    }).where(eq(users.id, userId));
    await tx.delete(teamMembers).where(eq(teamMembers.userId, userId));
    return true;
  });
}
