import { getUser } from '@/lib/db/queries';
import { isAdminUser } from '@/lib/auth/admin';

export async function GET() {
  const user = await getUser();
  if (!user) return Response.json(null);
  return Response.json({ ...user, isAdmin: isAdminUser(user) });
}
