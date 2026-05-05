import { getUser } from '@/lib/db/queries';
import { syncGmailReplies } from '@/lib/email/gmail';

export const runtime = 'nodejs';

export async function POST() {
  const user = await getUser();
  if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  try {
    return Response.json({ ok: true, ...(await syncGmailReplies(user.id)) });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : 'Could not sync Gmail replies.' },
      { status: 400 }
    );
  }
}
