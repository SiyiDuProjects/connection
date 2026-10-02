import { isAdminUser } from '@/lib/auth/admin';
import { toPublicUser } from '@/lib/auth/public-user';

export async function GET() {
  const headers = { 'Cache-Control': 'private, no-store' };
  if (!process.env.POSTGRES_URL) return Response.json(null, { headers });
  const { getUser } = await import('@/lib/db/queries');
  const user = await getUser();
  if (!user) return Response.json(null, { headers });
  return Response.json({ ...toPublicUser(user), isAdmin: isAdminUser(user) }, { headers });
}
