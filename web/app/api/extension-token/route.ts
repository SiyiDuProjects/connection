import { randomBytes, createHash } from 'crypto';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { extensionApiTokens } from '@/lib/db/schema';
import { getUser, hasActiveExtensionToken } from '@/lib/db/queries';

export async function GET() {
  const user = await getUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return Response.json({ hasToken: await hasActiveExtensionToken(user.id) });
}

export async function POST() {
  const user = await getUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await db
    .update(extensionApiTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(extensionApiTokens.userId, user.id),
        isNull(extensionApiTokens.revokedAt)
      )
    );

  const token = `fc_${randomBytes(32).toString('base64url')}`;
  await db.insert(extensionApiTokens).values({
    userId: user.id,
    tokenHash: hashToken(token)
  });

  return Response.json({ token });
}

export async function DELETE() {
  const user = await getUser();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await db
    .update(extensionApiTokens)
    .set({ revokedAt: new Date() })
    .where(
      and(
        eq(extensionApiTokens.userId, user.id),
        isNull(extensionApiTokens.revokedAt)
      )
    );

  return Response.json({ ok: true });
}

function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
