import 'server-only';

import { randomBytes, createHash } from 'node:crypto';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { emailVerificationTokens, users } from '@/lib/db/schema';
import { requireEmailDelivery, sendVerificationEmail } from '@/lib/email/resend';
import {
  CODE_TTL_MS, MAX_CODE_ATTEMPTS, MAX_SENDS_PER_HOUR, RESEND_COOLDOWN_MS,
  generateVerificationCode, hashVerificationCode, matchesVerificationCode,
} from './verification-code';

export class VerificationRateLimitError extends Error {
  retryAfter: number;
  constructor(retryAfter: number) {
    super('Please wait before requesting another code.');
    this.retryAfter = retryAfter;
  }
}

export async function issueEmailVerification(userId: number, email: string) {
  requireEmailDelivery();
  const verification = await db.transaction(async (tx) => {
    // Serialize issuance and verification per user, including concurrent requests.
    const [user] = await tx.select().from(users).where(eq(users.id, userId)).for('update');
    if (!user || user.emailVerifiedAt || user.deletedAt || user.email !== email) return null;
    const now = new Date();
    const recent = await tx.select().from(emailVerificationTokens).where(and(
      eq(emailVerificationTokens.userId, userId),
      gt(emailVerificationTokens.createdAt, new Date(now.getTime() - 60 * 60 * 1000)),
    )).orderBy(desc(emailVerificationTokens.createdAt));
    const latest = recent[0];
    if (latest && now.getTime() - latest.createdAt.getTime() < RESEND_COOLDOWN_MS) {
      throw new VerificationRateLimitError(Math.ceil((RESEND_COOLDOWN_MS - (now.getTime() - latest.createdAt.getTime())) / 1000));
    }
    if (recent.length >= MAX_SENDS_PER_HOUR) {
      throw new VerificationRateLimitError(Math.ceil((recent[recent.length - 1].createdAt.getTime() + 60 * 60 * 1000 - now.getTime()) / 1000));
    }
    const code = generateVerificationCode();
    const nonce = randomBytes(32).toString('hex');
    await tx.update(emailVerificationTokens).set({ usedAt: now }).where(and(
      eq(emailVerificationTokens.userId, userId), isNull(emailVerificationTokens.usedAt),
    ));
    const [record] = await tx.insert(emailVerificationTokens).values({
      userId, tokenHash: nonce,
      codeHash: hashVerificationCode(userId, nonce, code, process.env.AUTH_SECRET!),
      createdAt: now, expiresAt: new Date(now.getTime() + CODE_TTL_MS),
    }).returning();
    return { id: record.id, code, nonce };
  });
  if (!verification) return;
  try {
    await sendVerificationEmail(email, verification.code, verification.nonce);
  } catch {
    await db.update(emailVerificationTokens).set({ usedAt: new Date() }).where(eq(emailVerificationTokens.id, verification.id));
    throw new Error('We could not send your code. Please wait a minute and try again.');
  }
}

export async function verifyEmailCode(email: string, code: string) {
  if (!/^\d{6}$/.test(code)) return null;
  return db.transaction(async (tx) => {
    const [user] = await tx.select().from(users).where(eq(users.email, email)).for('update');
    if (!user || user.emailVerifiedAt || user.deletedAt) return null;
    const now = new Date();
    const [record] = await tx.select().from(emailVerificationTokens).where(and(
      eq(emailVerificationTokens.userId, user.id), isNull(emailVerificationTokens.usedAt),
      gt(emailVerificationTokens.expiresAt, now),
    )).orderBy(desc(emailVerificationTokens.createdAt)).limit(1);
    if (!record?.codeHash || record.attempts >= MAX_CODE_ATTEMPTS) return null;
    const matches = matchesVerificationCode(record.codeHash, hashVerificationCode(user.id, record.tokenHash, code, process.env.AUTH_SECRET || ''));
    const attempts = record.attempts + 1;
    await tx.update(emailVerificationTokens).set({
      attempts, usedAt: matches || attempts >= MAX_CODE_ATTEMPTS ? now : null,
    }).where(eq(emailVerificationTokens.id, record.id));
    if (!matches) return null;
    await tx.update(emailVerificationTokens).set({ usedAt: now }).where(and(
      eq(emailVerificationTokens.userId, user.id), isNull(emailVerificationTokens.usedAt),
    ));
    const [verified] = await tx.update(users).set({ emailVerifiedAt: now, updatedAt: now }).where(eq(users.id, user.id)).returning();
    return verified;
  });
}

// Compatibility for outstanding 24-hour links issued before the code flow.
export async function verifyEmailToken(token: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return null;
  const tokenHash = createHash('sha256').update(token).digest('hex');
  return db.transaction(async (tx) => {
    const [candidate] = await tx.select().from(emailVerificationTokens).where(eq(emailVerificationTokens.tokenHash, tokenHash)).limit(1);
    if (!candidate) return null;
    const [user] = await tx.select().from(users).where(eq(users.id, candidate.userId)).for('update');
    if (!user || user.deletedAt || user.emailVerifiedAt) return null;
    const now = new Date();
    const [record] = await tx.update(emailVerificationTokens).set({ usedAt: now }).where(and(
      eq(emailVerificationTokens.id, candidate.id), isNull(emailVerificationTokens.codeHash),
      isNull(emailVerificationTokens.usedAt), gt(emailVerificationTokens.expiresAt, now),
    )).returning();
    if (!record) return null;
    const [verified] = await tx.update(users).set({ emailVerifiedAt: now, updatedAt: now }).where(eq(users.id, user.id)).returning();
    return verified;
  });
}
