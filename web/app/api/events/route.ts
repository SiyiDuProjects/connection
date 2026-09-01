import { z } from 'zod';
import { getUser } from '@/lib/db/queries';
import { PRODUCT_EVENTS, recordProductEvent } from '@/lib/product-events';

const eventSchema = z.object({
  event: z.enum(PRODUCT_EVENTS),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional()
});

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

  const parsed = eventSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ ok: false, error: 'Invalid event.' }, { status: 400 });
  }

  await recordProductEvent(user.id, parsed.data.event, parsed.data.metadata || {});
  return Response.json({ ok: true });
}
