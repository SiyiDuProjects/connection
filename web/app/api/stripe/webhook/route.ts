import Stripe from 'stripe';
import { handleSubscriptionChange, stripe } from '@/lib/payments/stripe';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { stripeWebhookEvents } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { handleSuccessfulCheckoutSession } from '@/lib/payments/checkout';
import { handlePaidInvoice } from '@/lib/payments/invoices';

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: 'Billing is unavailable.' }, { status: 503 });
  const payload = await request.text();
  const signature = request.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'Missing webhook signature.' }, { status: 400 });
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, secret);
  } catch {
    return NextResponse.json({ error: 'Webhook signature verification failed.' }, { status: 400 });
  }
  try {
    const [existing] = await db.select().from(stripeWebhookEvents).where(eq(stripeWebhookEvents.id, event.id)).limit(1);
    if (existing?.processed) return NextResponse.json({ received: true, duplicate: true });
    await db.insert(stripeWebhookEvents).values({ id: event.id, type: event.type }).onConflictDoNothing();
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        await handleSuccessfulCheckoutSession((event.data.object as Stripe.Checkout.Session).id);
        break;
      case 'invoice.paid':
      case 'invoice.payment_succeeded':
        await handlePaidInvoice(event.data.object as Stripe.Invoice);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscriptionChange(event.data.object as Stripe.Subscription);
        break;
    }
    await db.update(stripeWebhookEvents).set({ processed: true }).where(eq(stripeWebhookEvents.id, event.id));
    return NextResponse.json({ received: true });
  } catch {
    console.error('Billing event requires retry', { eventId: event.id, type: event.type });
    return NextResponse.json({ error: 'Billing event could not be processed.' }, { status: 500 });
  }
}
