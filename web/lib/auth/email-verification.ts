import 'server-only';

import { randomBytes, createHash } from 'crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { emailVerificationTokens, users } from '@/lib/db/schema';

const TOKEN_BYTES = 32;
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function appUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    'http://localhost:3000'
  ).replace(/\/$/, '');
}

export async function createEmailVerification(userId: number) {
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await db
    .update(emailVerificationTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(emailVerificationTokens.userId, userId),
        isNull(emailVerificationTokens.usedAt)
      )
    );

  await db.insert(emailVerificationTokens).values({
    userId,
    tokenHash,
    expiresAt,
  });

  return {
    token,
    expiresAt,
    url: `${appUrl()}/verify-email/confirm?token=${encodeURIComponent(token)}`,
  };
}

export async function sendVerificationEmail(
  email: string,
  verificationUrl: string
) {
  const from = process.env.EMAIL_FROM;
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey || !from) {
    if (process.env.NODE_ENV !== 'production') {
      console.info(`Email verification link for ${email}: ${verificationUrl}`);
      return;
    }
    throw new Error('Email delivery is not configured.');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: email,
      subject: 'Verify your email',
      html: [
        '<p>Confirm your email address to finish signing in.</p>',
        `<p><a href="${verificationUrl}">Verify email</a></p>`,
        '<p>This link expires in 24 hours.</p>',
      ].join(''),
      text: `Confirm your email address to finish signing in:\n\n${verificationUrl}\n\nThis link expires in 24 hours.`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Email delivery failed with status ${response.status}.`);
  }
}

export async function issueEmailVerification(userId: number, email: string) {
  const verification = await createEmailVerification(userId);
  await sendVerificationEmail(email, verification.url);
  return verification;
}

export async function verifyEmailToken(token: string) {
  const tokenHash = hashToken(token);
  const [record] = await db
    .select()
    .from(emailVerificationTokens)
    .where(
      and(
        eq(emailVerificationTokens.tokenHash, tokenHash),
        isNull(emailVerificationTokens.usedAt),
        gt(emailVerificationTokens.expiresAt, new Date())
      )
    )
    .limit(1);

  if (!record) {
    return null;
  }

  const verifiedAt = new Date();

  const [user] = await db
    .update(users)
    .set({ emailVerifiedAt: verifiedAt, updatedAt: verifiedAt })
    .where(eq(users.id, record.userId))
    .returning();

  await db
    .update(emailVerificationTokens)
    .set({ usedAt: verifiedAt })
    .where(eq(emailVerificationTokens.id, record.id));

  return user || null;
}
