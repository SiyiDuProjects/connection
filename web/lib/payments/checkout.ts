import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { creditLedger, teamMembers, teams, users } from '@/lib/db/schema';
import { resolveSubscriptionPlan, stripe } from '@/lib/payments/stripe';
import { applyPendingFriendInviteRewards } from '@/lib/payments/friend-invite-rewards';
import { canFulfillCheckout, isTerminalSubscription, stripeObjectId, invoiceSubscriptionId, isMembershipInvoiceLine, invoiceLinePriceId } from '@/lib/payments/billing-policy';
import { recordProductEvent } from '@/lib/product-events';
import { entitlementGrantMetadata } from '@/lib/payments/plans';

export async function handleSuccessfulCheckoutSession(
  sessionId: string,
  options: { expectedUserId?: number } = {}
) {
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.mode !== 'subscription' || session.status !== 'complete'
    || !['paid', 'no_payment_required'].includes(session.payment_status)) return null;
  const userId = Number(session.client_reference_id);
  if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error('Checkout has no valid account owner.');
  if (options.expectedUserId !== undefined && userId !== options.expectedUserId) {
    throw new Error('Checkout session does not belong to the signed-in user.');
  }
  const customerId = stripeObjectId(session.customer);
  const subscriptionId = stripeObjectId(session.subscription);
  if (!customerId || !subscriptionId) throw new Error('Checkout has no customer or subscription.');

  const [user] = await db.select().from(users).where(and(eq(users.id, userId), isNull(users.deletedAt))).limit(1);
  if (!user) throw new Error('Checkout account is unavailable.');
  const memberships = await db.select({ teamId: teamMembers.teamId }).from(teamMembers)
    .where(and(eq(teamMembers.userId, userId), eq(teamMembers.role, 'owner')));
  const metadataTeamId = Number(session.metadata?.reachardTeamId);
  const membership = metadataTeamId
    ? memberships.find(member => member.teamId === metadataTeamId)
    : memberships.length === 1 ? memberships[0] : null;
  if (!membership) throw new Error('Checkout team ownership could not be verified.');

  const outcome = await db.transaction(async tx => {
    const [team] = await tx.select().from(teams).where(eq(teams.id, membership.teamId)).for('update');
    if (!team || (team.stripeCustomerId && team.stripeCustomerId !== customerId)) {
      throw new Error('Checkout customer does not match the account.');
    }
    // Fetch after acquiring the same row lock used by subscription webhooks.
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, { expand: ['items.data.price.product'] });
    if (!canFulfillCheckout(session, subscription)) return null;
    const currentPlan = await resolveSubscriptionPlan(subscription);
    if (team.stripeSubscriptionId && team.stripeSubscriptionId !== subscriptionId) {
      const current = await stripe.subscriptions.retrieve(team.stripeSubscriptionId);
      if (!isTerminalSubscription(current.status)) throw new Error('A different subscription already exists.');
      if (current.created >= subscription.created) return null;
    }
    const checkoutItems = await stripe.checkout.sessions.listLineItems(session.id, { limit: 2, expand: ['data.price.product'] });
    if (checkoutItems.has_more || checkoutItems.data.length !== 1 || checkoutItems.data[0].quantity !== 1 || !checkoutItems.data[0].price) {
      throw new Error('Checkout must contain one purchased membership.');
    }
    const purchasedPrice = checkoutItems.data[0].price;
    const plan = await resolveSubscriptionPlan({ ...subscription, items: { ...subscription.items,
      data: [{ ...subscription.items.data[0], price: purchasedPrice, quantity: 1 }] } });
    let periodStart = subscription.items.data[0].current_period_start;
    let periodEnd = subscription.items.data[0].current_period_end;
    const invoiceId = stripeObjectId(session.invoice);
    if (invoiceId) {
      const initialInvoice = await stripe.invoices.retrieve(invoiceId);
      if (initialInvoice.status !== 'paid' || invoiceSubscriptionId(initialInvoice) !== subscriptionId
        || stripeObjectId(initialInvoice.customer) !== customerId) throw new Error('Checkout invoice is not paid for this membership.');
      let lines = initialInvoice.lines.data;
      if (initialInvoice.lines.has_more) {
        lines = [];
        for await (const line of stripe.invoices.listLineItems(invoiceId, { limit: 100 })) lines.push(line);
      }
      const purchasedLines = lines.filter(line => isMembershipInvoiceLine(line, subscriptionId)
        && invoiceLinePriceId(line) === purchasedPrice.id);
      if (purchasedLines.length !== 1) throw new Error('Checkout invoice does not match the purchased membership.');
      periodStart = purchasedLines[0].period.start;
      periodEnd = purchasedLines[0].period.end;
    } else if (plan.entitlementVersion) {
      throw new Error('Checkout is awaiting its paid membership invoice.');
    }
    await tx.execute(sql`select pg_advisory_xact_lock(${userId}::bigint)`);
    if (!Number.isSafeInteger(subscription.items.data[0].current_period_end)) {
      throw new Error('Subscription billing period is unavailable.');
    }
    await tx.update(teams).set({
      stripeCustomerId: customerId, stripeSubscriptionId: subscriptionId,
      stripeProductId: currentPlan.productId, planName: currentPlan.name,
      subscriptionStatus: subscription.status, updatedAt: new Date()
    }).where(eq(teams.id, team.id));

    const [existing] = await tx.select({ id: creditLedger.id }).from(creditLedger)
      .where(and(eq(creditLedger.action, 'subscription.initial_grant'),
        sql`${creditLedger.metadata}->>'subscriptionId' = ${subscriptionId}`)).limit(1);
    if (!existing) {
      await tx.insert(creditLedger).values({ userId, amount: plan.monthlyCredits,
        action: 'subscription.initial_grant', metadata: {
          subscriptionId, checkoutSessionId: session.id,
          ...entitlementGrantMetadata(plan, periodStart, periodEnd)
        }
      }).onConflictDoNothing();
    }
    return { granted: !existing, planName: plan.name };
  });
  if (!outcome) return null;
  // A paid invoice determines referral eligibility; starting a trial does not.
  await applyPendingFriendInviteRewards(userId);
  if (outcome.granted) await recordProductEvent(userId, 'subscription.started', {
    checkoutSessionId: session.id, subscriptionId, planName: outcome.planName
  });
  return user;
}
