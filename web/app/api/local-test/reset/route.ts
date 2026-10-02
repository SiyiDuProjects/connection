import { cookies } from 'next/headers';
import { getUser } from '@/lib/db/queries';
import { deleteAccountData } from '@/lib/delete-account-data';
import { localTestEnabled, isLocalTestEmail } from '@/lib/auth/local-test-policy';
import { db } from '@/lib/db/drizzle';
import { freeTrialClaims } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(request: Request) {
  if (!localTestEnabled()) return new Response(null, { status: 404 });
  const origin = request.headers.get('origin');
  if (origin !== 'http://127.0.0.1:3000' && origin !== 'http://localhost:3000') return new Response(null, { status: 403 });
  const user = await getUser();
  if (user && !isLocalTestEmail(user.email)) return new Response(null, { status: 403 });
  if (user) {
    const deleted = await deleteAccountData(user.id, null, { sessionVersion: user.sessionVersion, passwordHash: user.passwordHash });
    if (!deleted) return Response.json({ ok: false }, { status: 409 });
    await db.delete(freeTrialClaims).where(eq(freeTrialClaims.userId, user.id));
  }
  (await cookies()).delete('session');
  return Response.json({ ok: true });
}
