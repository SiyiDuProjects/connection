import Stripe from 'stripe';
import { handleSubscriptionChange, resolveSubscriptionPlan, stripe } from '@/lib/payments/stripe';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db/drizzle';
import { creditLedger, stripeWebhookEvents, teams, teamMembers } from '@/lib/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { handleSuccessfulCheckoutSession } from '@/lib/payments/checkout';
import { recordProductEvent } from '@/lib/product-events';

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const signature = request.headers.get('stripe-signature') as string;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed.', err);
    return NextResponse.json(
      { error: 'Webhook signature verification failed.' },
      { status: 400 }
    );
  }

  const existing = await db
    .select()
    .from(stripeWebhookEvents)
    .where(eq(stripeWebhookEvents.id, event.id))
    .limit(1);

  if (existing[0]?.processed) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  if (existing.length === 0) {
    await db
      .insert(stripeWebhookEvents)
      .values({ id: event.id, type: event.type })
      .onConflictDoNothing();
  }

  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      await handleSuccessfulCheckoutSession((event.data.object as Stripe.Checkout.Session).id);
      break;
    case 'invoice.payment_succeeded':
      await grantRenewalCredits(event.data.object as Stripe.Invoice);
      break;
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      const subscription = event.data.object as Stripe.Subscription;
      await handleSubscriptionChange(subscription);
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  await db
    .update(stripeWebhookEvents)
    .set({ processed: true })
    .where(eq(stripeWebhookEvents.id, event.id));

  return NextResponse.json({ received: true });
}

async function grantRenewalCredits(invoice: Stripe.Invoice) {
  if (invoice.billing_reason !== 'subscription_cycle') {
    return;
  }

  const invoiceWithSubscription = invoice as Stripe.Invoice & {
    subscription?: string | { id?: string };
  };
  const subscriptionId =
    typeof invoiceWithSubscription.subscription === 'string'
      ? invoiceWithSubscription.subscription
      : invoiceWithSubscription.subscription?.id;

  if (!subscriptionId) {
    return;
  }

  const [team] = await db
    .select()
    .from(teams)
    .where(eq(teams.stripeSubscriptionId, subscriptionId))
    .limit(1);

  if (!team) {
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['items.data.price.product']
  });
  const plan = await resolveSubscriptionPlan(subscription);

  const [member] = await db
    .select()
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.teamId, team.id),
        eq(teamMembers.role, 'owner')
      )
    )
    .limit(1);

  if (!member) {
    return;
  }

  const existingGrant = await db
    .select({ id: creditLedger.id })
    .from(creditLedger)
    .where(
      and(
        eq(creditLedger.userId, member.userId),
        eq(creditLedger.action, 'subscription.monthly_grant'),
        sql`${creditLedger.metadata}->>'invoiceId' = ${invoice.id}`
      )
    )
    .limit(1);

  if (existingGrant.length > 0) {
    return;
  }

  await db
    .insert(creditLedger)
    .values({
      userId: member.userId,
      amount: plan.monthlyCredits,
      action: 'subscription.monthly_grant',
      metadata: { subscriptionId, invoiceId: invoice.id, planName: plan.name }
    })
    .onConflictDoNothing();

  await recordProductEvent(member.userId, 'subscription.renewed', {
    invoiceId: invoice.id,
    subscriptionId,
    planName: plan.name
  });
}
