import { z } from 'zod';
import { getUser } from '@/lib/db/queries';
import { sendTrackedGmail } from '@/lib/email/gmail';

export const runtime = 'nodejs';

const sendSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
  contact: z.record(z.unknown()).optional(),
  job: z.record(z.unknown()).optional()
});

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const parsed = sendSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ ok: false, error: 'Check the email fields and try again.' }, { status: 400 });
  }

  try {
    const result = await sendTrackedGmail({ userId: user.id, ...parsed.data });
    return Response.json({ ok: true, ...result });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : 'Could not send email.' },
      { status: 400 }
    );
  }
}
