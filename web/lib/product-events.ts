import 'server-only';
import { db } from '@/lib/db/drizzle';
import { productEvents } from '@/lib/db/schema';

export const PRODUCT_EVENTS = [
  'extension.connected',
  'onboarding.completed',
  'checkout.started',
  'subscription.started',
  'subscription.paid',
  'subscription.renewed'
] as const;

export type ProductEventName = (typeof PRODUCT_EVENTS)[number];

export async function recordProductEvent(
  userId: number,
  event: ProductEventName,
  metadata: Record<string, unknown> = {}
) {
  try {
    await db.insert(productEvents).values({ userId, event, metadata });
  } catch (error) {
    console.error('Could not record product event.', { userId, event, error });
  }
}
