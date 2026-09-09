import { z } from 'zod';
import { getActiveExtensionTokenInfo, getUser } from '@/lib/db/queries';
import { recordProductEvent } from '@/lib/product-events';

// Checkout, payment and onboarding outcomes are written by their server handlers.
// A browser must never be able to manufacture paid conversions in the admin funnel.
const eventSchema = z.object({ event: z.literal('extension.connected') }).strict();

export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return Response.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  const parsed = eventSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ ok: false, error: 'Invalid client event.' }, { status: 400 });
  const token = await getActiveExtensionTokenInfo(user.id);
  if (!token) return Response.json({ ok: false, error: 'Connect the extension first.' }, { status: 409 });
  await recordProductEvent(user.id, 'extension.connected', { tokenId: token.id, source: 'client-confirmed' });
  return Response.json({ ok: true });
}
