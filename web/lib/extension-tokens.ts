import { randomBytes, createHash } from 'crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { extensionApiTokens, users } from '@/lib/db/schema';

export async function createExtensionToken(userId: number) {
  const token = `fc_${randomBytes(32).toString('base64url')}`;
  const createdToken = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(${userId})`
    );
    await tx
      .update(extensionApiTokens)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(extensionApiTokens.userId, userId),
          isNull(extensionApiTokens.revokedAt)
        )
      );

    const [created] = await tx
      .insert(extensionApiTokens)
      .values({
        userId,
        tokenHash: hashToken(token)
      })
      .returning({ id: extensionApiTokens.id });
    if (!created) throw new Error('Could not create extension token.');
    return created;
  });

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

export async function getUserFromExtensionBearer(request: Request) {
  const token = getBearerToken(request);
  if (!token) return null;

  const [result] = await db
    .select({ user: users, tokenId: extensionApiTokens.id })
    .from(extensionApiTokens)
    .innerJoin(users, eq(users.id, extensionApiTokens.userId))
    .where(
      and(
        eq(extensionApiTokens.tokenHash, hashToken(token)),
        isNull(extensionApiTokens.revokedAt),
        isNull(users.deletedAt)
      )
    )
    .limit(1);

  if (!result) return null;

  await db
    .update(extensionApiTokens)
    .set({ lastUsedAt: new Date() })
    .where(eq(extensionApiTokens.id, result.tokenId))
    .catch(() => {});

  return result.user;
}

function getBearerToken(request: Request) {
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || '';
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
