import 'server-only';

import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { extensionApiTokens, passwordResetTokens, users } from '@/lib/db/schema';
import { requireEmailDelivery, sendPasswordResetEmail } from '@/lib/email/resend';
import { hashPassword } from '@/lib/auth/session';
import { isSupportedNewPassword } from '@/lib/auth/password-policy';
import {
  PASSWORD_RESET_COOLDOWN_MS, PASSWORD_RESET_MAX_PER_HOUR, PASSWORD_RESET_TTL_MS,
  hashPasswordResetToken, isPasswordResetToken, newPasswordResetToken, passwordResetUrl,
} from './password-reset-token';

// This service runs after the generic public response. No account existence,
// delivery result, token, or per-account rate-limit result reaches the caller.
export async function issuePasswordReset(address: string): Promise<void> {
  requireEmailDelivery();
  const email = address.trim().toLowerCase();
  const token = newPasswordResetToken();
  const url = passwordResetUrl(token);
  const record = await db.transaction(async tx => {
    const [user] = await tx.select().from(users).where(eq(users.email, email)).for('update');
    if (!user || user.deletedAt) return null;
    const now = new Date();
    const recent = await tx.select().from(passwordResetTokens).where(and(
      eq(passwordResetTokens.userId, user.id),
      gt(passwordResetTokens.createdAt, new Date(now.getTime() - 60 * 60 * 1000)),
    )).orderBy(desc(passwordResetTokens.createdAt));
    if ((recent[0] && now.getTime() - recent[0].createdAt.getTime() < PASSWORD_RESET_COOLDOWN_MS)
      || recent.length >= PASSWORD_RESET_MAX_PER_HOUR) return null;
    await tx.update(passwordResetTokens).set({ usedAt: now }).where(and(
      eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.usedAt),
    ));
    const [created] = await tx.insert(passwordResetTokens).values({
      userId: user.id, email: user.email, tokenHash: hashPasswordResetToken(token),
      sessionVersion: user.sessionVersion, createdAt: now,
      expiresAt: new Date(now.getTime() + PASSWORD_RESET_TTL_MS),
    }).returning();
    return created;
  });
  if (!record) return;
  try {
    await sendPasswordResetEmail(email, url, record.tokenHash);
  } catch {
    await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, record.id));
    throw new Error('Password reset delivery failed.');
  }
}

export async function resetPassword(token: string, password: string) {
  if (!isPasswordResetToken(token) || !isSupportedNewPassword(password)) return null;
  const tokenHash = hashPasswordResetToken(token);
  const [candidate] = await db.select().from(passwordResetTokens).where(and(
    eq(passwordResetTokens.tokenHash, tokenHash), isNull(passwordResetTokens.usedAt),
    gt(passwordResetTokens.expiresAt, new Date()),
  )).limit(1);
  if (!candidate) return null;
  const passwordHash = await hashPassword(password);
  return db.transaction(async tx => {
    const [user] = await tx.select().from(users).where(eq(users.id, candidate.userId)).for('update');
    if (!user || user.deletedAt || user.email !== candidate.email || user.sessionVersion !== candidate.sessionVersion) return null;
    const now = new Date();
    // Conditional consumption is checked after hashing and taking the user lock.
    // Two concurrent resets cannot both change the password or reuse this token.
    const [consumed] = await tx.update(passwordResetTokens).set({ usedAt: now }).where(and(
      eq(passwordResetTokens.id, candidate.id), isNull(passwordResetTokens.usedAt),
      gt(passwordResetTokens.expiresAt, now),
    )).returning();
    if (!consumed) return null;
    await tx.update(users).set({ passwordHash, sessionVersion: user.sessionVersion + 1, updatedAt: now })
      .where(eq(users.id, user.id));
    await tx.update(extensionApiTokens).set({ revokedAt: now }).where(eq(extensionApiTokens.userId, user.id));
    await tx.update(passwordResetTokens).set({ usedAt: now }).where(and(
      eq(passwordResetTokens.userId, user.id), isNull(passwordResetTokens.usedAt),
    ));
    return { email: user.email, deliveryId: consumed.tokenHash };
  });
}

// The account-settings path shares the same revocation boundary as recovery.
// An old password verified just before a reset cannot overwrite the new one.
export async function changeAuthenticatedPassword(userId: number, expectedHash: string, passwordHash: string, expectedSessionVersion: number) {
  return db.transaction(async tx => {
    const [user] = await tx.select().from(users).where(eq(users.id, userId)).for('update');
    if (!user || user.deletedAt || user.passwordHash !== expectedHash || user.sessionVersion !== expectedSessionVersion) return null;
    const now = new Date();
    const [updated] = await tx.update(users).set({ passwordHash, sessionVersion: user.sessionVersion + 1, updatedAt: now })
      .where(eq(users.id, userId)).returning();
    await tx.update(extensionApiTokens).set({ revokedAt: now }).where(eq(extensionApiTokens.userId, userId));
    await tx.update(passwordResetTokens).set({ usedAt: now }).where(and(
      eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt),
    ));
    return updated;
  });
}
