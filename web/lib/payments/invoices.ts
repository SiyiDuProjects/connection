import type Stripe from 'stripe';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { creditLedger, teamMembers, teams } from '@/lib/db/schema';
import { stripe } from '@/lib/payments/stripe';
import { requireReachardPlanByName } from '@/lib/payments/plans';
import { invoiceSubscriptionId, isPaidRewardInvoice, stripeObjectId } from '@/lib/payments/billing-policy';
import { handleSuccessfulCheckoutSession } from '@/lib/payments/checkout';
import { grantFriendInvitePurchaseReward } from '@/lib/payments/friend-invite-rewards';
import { recordProductEvent } from '@/lib/product-events';

export async function handlePaidInvoice(invoice: Stripe.Invoice) {
  if (invoice.status !== 'paid') return;
  const subscriptionId = invoiceSubscriptionId(invoice);
  if (!subscriptionId || !['subscription_create', 'subscription_cycle'].includes(invoice.billing_reason || '')) return;

  let [team] = await db.select().from(teams).where(eq(teams.stripeSubscriptionId, subscriptionId)).limit(1);
  const [initialGrant] = await db.select({ id: creditLedger.id }).from(creditLedger).where(and(
    eq(creditLedger.action, 'subscription.initial_grant'), sql`${creditLedger.metadata}->>'subscriptionId' = ${subscriptionId}`
  )).limit(1);
  if (!team || !initialGrant) {
    // Recover initial fulfillment when the invoice arrives before the Checkout event.
    const sessions = await stripe.checkout.sessions.list({ subscription: subscriptionId, limit: 100 });
    const session = sessions.data.find(item => item.mode === 'subscription' && item.status === 'complete' && item.client_reference_id);
    if (session) await handleSuccessfulCheckoutSession(session.id);
    [team] = await db.select().from(teams).where(eq(teams.stripeSubscriptionId, subscriptionId)).limit(1);
    if (!team) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      if (session || subscription.metadata?.reachardTeamId) throw new Error('Reachard invoice is awaiting account mapping.');
      return;
    }
  }
  if (stripeObjectId(invoice.customer) !== team.stripeCustomerId) throw new Error('Invoice customer does not match the account.');

  const outcome = await db.transaction(async tx => {
    const [locked] = await tx.select().from(teams).where(eq(teams.id, team.id)).for('update');
    if (locked.stripeSubscriptionId !== subscriptionId) return null;
    const [owner] = await tx.select({ userId: teamMembers.userId }).from(teamMembers)
      .where(and(eq(teamMembers.teamId, team.id), eq(teamMembers.role, 'owner'))).limit(1);
    if (!owner) throw new Error('Reachard invoice account has no owner.');
    const [initial] = await tx.select().from(creditLedger).where(and(
      eq(creditLedger.action, 'subscription.initial_grant'), sql`${creditLedger.metadata}->>'subscriptionId' = ${subscriptionId}`
    )).limit(1);
    if (!initial) throw new Error('Invoice is awaiting initial subscription fulfillment.');
    let granted = false;
    let planName: string | null = null;
    if (invoice.billing_reason === 'subscription_cycle') {
      const [existing] = await tx.select({ id: creditLedger.id }).from(creditLedger).where(and(
        eq(creditLedger.action, 'subscription.monthly_grant'), sql`${creditLedger.metadata}->>'invoiceId' = ${invoice.id}`
      )).limit(1);
      if (!existing) {
        // A delayed invoice uses the purchased price, not a later subscription upgrade.
        let lines = invoice.lines.data;
        if (invoice.lines.has_more) {
          lines = [];
          for await (const line of stripe.invoices.listLineItems(invoice.id!, { limit: 100 })) lines.push(line);
        }
        const line = lines.find(item => {
          const legacy = item as unknown as { type?: string; subscription?: unknown; proration?: boolean };
          return item.parent?.type === 'subscription_item_details'
            ? !item.parent.subscription_item_details?.proration
              && stripeObjectId(item.parent.subscription_item_details?.subscription) === subscriptionId
            : legacy.type === 'subscription' && !legacy.proration
              && (!legacy.subscription || stripeObjectId(legacy.subscription) === subscriptionId);
        });
        const priceId = stripeObjectId(line?.pricing?.price_details?.price)
          || stripeObjectId((line as unknown as { price?: unknown } | undefined)?.price);
        if (!priceId) throw new Error('Paid subscription invoice has no recurring price.');
        if (!Number.isSafeInteger(line?.period.end)) throw new Error('Invoice billing period is unavailable.');
        const price = await stripe.prices.retrieve(priceId, { expand: ['product'] });
        const product = typeof price.product === 'string' ? await stripe.products.retrieve(price.product) : price.product;
        if ('deleted' in product && product.deleted) throw new Error('Invoice product is unavailable.');
        const plan = requireReachardPlanByName((product as Stripe.Product).name);
        planName = plan.name;
        await tx.insert(creditLedger).values({ userId: owner.userId, amount: plan.monthlyCredits,
          action: 'subscription.monthly_grant', metadata: {
            subscriptionId, invoiceId: invoice.id, planName: plan.name, periodEnd: line?.period.end
          }
        }).onConflictDoNothing();
        granted = true;
      }
    }
    const metadata = initial.metadata as Record<string, unknown> | null;
    return { userId: owner.userId, checkoutSessionId: String(metadata?.checkoutSessionId || ''), granted, planName };
  });
  if (!outcome) return;
  if (isPaidRewardInvoice(invoice) && outcome.checkoutSessionId) await grantFriendInvitePurchaseReward({
    invitedUserId: outcome.userId, checkoutSessionId: outcome.checkoutSessionId, subscriptionId
  });
  if (outcome.granted) await recordProductEvent(outcome.userId, 'subscription.renewed', {
    invoiceId: invoice.id, subscriptionId, planName: outcome.planName
  });
}
