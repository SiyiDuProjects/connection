import { randomBytes, createHash } from 'crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { extensionApiTokens } from '@/lib/db/schema';

export async function createExtensionToken(userId: number) {
  await db
    .update(extensionApiTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(extensionApiTokens.userId, userId),
        isNull(extensionApiTokens.revokedAt)
      )
    );

  const token = `fc_${randomBytes(32).toString('base64url')}`;
  const [createdToken] = await db
    .insert(extensionApiTokens)
    .values({
      userId,
      tokenHash: hashToken(token)
    })
    .returning({ id: extensionApiTokens.id });

  return { token, tokenId: createdToken.id };
}

export async function revokeExtensionTokens(userId: number) {
  await db
    .update(extensionApiTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(extensionApiTokens.userId, userId),
        isNull(extensionApiTokens.revokedAt)
      )
    );
}

export async function revokeExtensionToken(userId: number, tokenId: number) {
  await db
    .update(extensionApiTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(extensionApiTokens.userId, userId),
        eq(extensionApiTokens.id, tokenId),
        isNull(extensionApiTokens.revokedAt)
      )
    );
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
