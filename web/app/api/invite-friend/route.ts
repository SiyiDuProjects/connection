import { randomBytes } from 'crypto';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { friendInviteRedemptions, friendInvites } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';

export async function GET(request: Request) {
  const user = await getUser();
  if (!user) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const invite = await getOrCreateInvite(user.id);
  return Response.json(await invitePayload(request, invite));
}

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) {
    return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const invite = await getOrCreateInvite(user.id, true);
  return Response.json(await invitePayload(request, invite));
}

async function getOrCreateInvite(userId: number, touch = false) {
  const [existing] = await db
    .select()
    .from(friendInvites)
    .where(eq(friendInvites.inviterUserId, userId))
    .limit(1);

  if (existing) {
    if (touch) {
      const [updated] = await db
        .update(friendInvites)
        .set({ lastGeneratedAt: new Date() })
        .where(eq(friendInvites.id, existing.id))
        .returning();
      return updated || existing;
    }
    return existing;
  }

  const [created] = await db
    .insert(friendInvites)
    .values({
      inviterUserId: userId,
      token: randomBytes(18).toString('base64url'),
      lastGeneratedAt: new Date()
    })
    .returning();

  if (!created) {
    throw new Error('Could not create invite.');
  }

  return created;
}

async function invitePayload(request: Request, invite: typeof friendInvites.$inferSelect) {
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(friendInviteRedemptions)
    .where(eq(friendInviteRedemptions.inviteId, invite.id));

  const url = new URL(request.url);
  const origin = process.env.APP_URL || process.env.BASE_URL || url.origin;
  const link = new URL('/sign-up', origin);
  link.searchParams.set('ref', invite.token);

  return {
    ok: true,
    link: link.toString(),
    token: invite.token,
    acceptedCount: Number(count || 0),
    generatedAt: invite.lastGeneratedAt
  };
}
