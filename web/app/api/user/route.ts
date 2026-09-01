import { getUser } from '@/lib/db/queries';
import { isAdminUser } from '@/lib/auth/admin';
import { toPublicUser } from '@/lib/auth/public-user';

export async function GET() {
  const user = await getUser();
  if (!user) return Response.json(null);
  return Response.json({ ...toPublicUser(user), isAdmin: isAdminUser(user) });
}
