import { eq, sql } from 'drizzle-orm';
import { isAdminUser } from '@/lib/auth/admin';
import { db } from '@/lib/db/drizzle';
import { creditLedger, users } from '@/lib/db/schema';
import { getUser } from '@/lib/db/queries';

export async function POST(request: Request) {
  const admin = await getUser();
  if (!admin) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isAdminUser(admin)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const payload = await request.json().catch(() => ({}));
  const email = clean(payload.email).toLowerCase();
  const note = clean(payload.note);
  const amount = Number(payload.amount);

  if (!email) {
    return Response.json({ error: 'Email is required.' }, { status: 400 });
  }
  if (!Number.isInteger(amount) || amount <= 0) {
    return Response.json(
      { error: 'Contact Kit amount must be a positive integer.' },
      { status: 400 }
    );
  }

  const [targetUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!targetUser || targetUser.deletedAt) {
    return Response.json({ error: 'User not found.' }, { status: 404 });
  }

  await db.insert(creditLedger).values({
    userId: targetUser.id,
    amount,
    action: 'admin.credit_grant',
    metadata: {
      adminEmail: admin.email,
      note
    }
  });

  const [balanceRow] = await db
    .select({
      balance: sql<number>`coalesce(sum(${creditLedger.amount}), 0)::int`
    })
    .from(creditLedger)
    .where(eq(creditLedger.userId, targetUser.id));

  return Response.json({
    ok: true,
    user: {
      id: targetUser.id,
      email: targetUser.email
    },
    credits: {
      balance: Number(balanceRow?.balance || 0)
    }
  });
}

function clean(value: unknown) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}
