import { getUser } from '@/lib/db/queries';
import { disconnectGmail } from '@/lib/email/gmail';

export const runtime = 'nodejs';

export async function POST() {
  const user = await getUser();
  if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  await disconnectGmail(user.id);
  return Response.json({ ok: true });
}
