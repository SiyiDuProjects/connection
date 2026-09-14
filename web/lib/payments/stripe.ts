import Stripe from 'stripe';
import { createHash } from 'node:crypto';
import { redirect } from 'next/navigation';
import { Team, teams } from '@/lib/db/schema';
import { db } from '@/lib/db/drizzle';
import { eq } from 'drizzle-orm';
import { isMonthlyPrice, isTerminalSubscription, stripeObjectId } from '@/lib/payments/billing-policy';
import {
  getTeamByStripeCustomerId,
  getUser
} from '@/lib/db/queries';
import {
  getReachardPlanByName,
  ENTITLEMENT_VERSION,
  resolvePurchasedPlan,
  type ReachardPlan
} from '@/lib/payments/plans';
import { recordProductEvent } from '@/lib/product-events';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function createCheckoutSession({
  team,
  priceId
}: {
  team: Team | null;
  priceId: string;
}) {
  const user = await getUser();

  if (!team || !user) {
    redirect(`/sign-up?redirect=checkout&priceId=${priceId}`);
  }

  const checkoutPlan = await resolveCheckoutPlan(priceId);
  const result = await db.transaction(async tx => {
    const [currentTeam] = await tx.select().from(teams).where(eq(teams.id, team.id)).for('update');
    if (!currentTeam) throw new Error('Billing account is unavailable.');
    let customerId = currentTeam.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email, metadata: { reachardTeamId: String(team.id), reachardUserId: String(user.id) }
      }, { idempotencyKey: `reachard-customer-${team.id}` });
      customerId = customer.id;
      await tx.update(teams).set({ stripeCustomerId: customerId, updatedAt: new Date() }).where(eq(teams.id, team.id));
    }
    const subscriptions = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 100 });
    if (subscriptions.has_more || subscriptions.data.some(subscription => !isTerminalSubscription(subscription.status))) {
      return { url: '/dashboard?billing=already-active', sessionId: null };
    }
    const sessions = await stripe.checkout.sessions.list({ customer: customerId, status: 'open', limit: 100 });
    if (sessions.has_more) throw new Error('Too many pending checkouts. Contact support.');
    for (const session of sessions.data) {
      if (session.mode !== 'subscription' || session.metadata?.reachardTeamId !== String(team.id)) continue;
      const items = await stripe.checkout.sessions.listLineItems(session.id, { limit: 2 });
      if (items.data.length === 1 && items.data[0].price?.id === checkoutPlan.priceId && session.url) {
        return { url: session.url, sessionId: session.id };
      }
      // Changing plan retires the user's unfinished session before creating another one.
      // If payment won the race, Stripe rejects expiration and no second session is created.
      await stripe.checkout.sessions.expire(session.id);
    }
    const metadata = {
      reachardUserId: String(user.id), reachardTeamId: String(team.id), reachardPlan: checkoutPlan.name
    };
    const recent = await stripe.checkout.sessions.list({ customer: customerId, limit: 1 });
    const attempt = createHash('sha256').update(JSON.stringify(recent.data.map(item => [item.id, item.status]))).digest('hex');
    const trialDays = subscriptions.data.length === 0 ? checkoutPlan.trialPeriodDays : 0;
    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: checkoutPlan.priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: `${process.env.BASE_URL}/api/stripe/checkout?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.BASE_URL}/pricing`,
      customer: customerId, client_reference_id: String(user.id),
      allow_promotion_codes: true, metadata,
      integration_identifier: 'reachard-checkout-hqmrzdka',
      subscription_data: { metadata, ...(trialDays ? { trial_period_days: trialDays } : {}) }
    }, { idempotencyKey: `checkout-${team.id}-${checkoutPlan.priceId}-${attempt}` });
    if (!session.url) throw new Error('Stripe did not return a checkout URL.');
    return { url: session.url, sessionId: session.id };
  });
  if (result.sessionId) await recordProductEvent(user.id, 'checkout.started', {
    checkoutSessionId: result.sessionId, planName: checkoutPlan.name
  });
  redirect(result.url);
}

export async function createCustomerPortalSession(team: Team) {
  if (!team.stripeCustomerId) redirect('/pricing');
  const base = await resolveCheckoutPlan(getReachardPlanByName('Base')!.configuredPriceId);
  const plus = await resolveCheckoutPlan(getReachardPlanByName('Plus')!.configuredPriceId);
  const products = [base, plus].map(plan => ({ product: plan.productId, prices: [plan.priceId] }));
  const policyId = 'personal-membership-v2';
  const validConfiguration = (item: Stripe.BillingPortal.Configuration) => {
    const update = item.features.subscription_update;
    return item.active && item.metadata?.reachardPolicy === policyId
      && item.features.subscription_cancel.enabled && item.features.subscription_cancel.mode === 'at_period_end'
      && update.enabled && update.proration_behavior === 'always_invoice'
      && update.default_allowed_updates.length === 1 && update.default_allowed_updates[0] === 'price'
      && update.schedule_at_period_end?.conditions?.some(condition => condition.type === 'decreasing_item_amount')
      && JSON.stringify(update.products?.map(product => ({ product: product.product, prices: [...product.prices].sort() }))
        .sort((a, b) => a.product.localeCompare(b.product)))
        === JSON.stringify([...products].sort((a, b) => a.product.localeCompare(b.product)));
  };
  const configuredId = process.env.STRIPE_PORTAL_CONFIGURATION_ID?.trim();
  let configuration: Stripe.BillingPortal.Configuration | undefined;
  if (configuredId) {
    const configured = await stripe.billingPortal.configurations.retrieve(configuredId);
    if (validConfiguration(configured)) configuration = configured;
  }
  if (!configuration) {
    const configurations = await stripe.billingPortal.configurations.list({ active: true, limit: 100 });
    configuration = configurations.data.find(validConfiguration);
  }
  if (!configuration) {
    configuration = await stripe.billingPortal.configurations.create({
      metadata: { reachardPolicy: policyId },
      business_profile: { headline: 'Manage your Reachard membership' },
      features: {
        subscription_update: { enabled: true, default_allowed_updates: ['price'], products,
          proration_behavior: 'always_invoice',
          schedule_at_period_end: { conditions: [{ type: 'decreasing_item_amount' }] } },
        subscription_cancel: { enabled: true, mode: 'at_period_end' },
        payment_method_update: { enabled: true },
        invoice_history: { enabled: true }
      }
    }, { idempotencyKey: `reachard-portal-${policyId}-${createHash('sha256').update(JSON.stringify(products)).digest('hex')}` });
  }
  return stripe.billingPortal.sessions.create({
    customer: team.stripeCustomerId,
    return_url: `${process.env.BASE_URL}/dashboard/general`,
    configuration: configuration.id
  });
}

export async function handleSubscriptionChange(eventSubscription: Stripe.Subscription) {
  const customerId = stripeObjectId(eventSubscription.customer);
  if (!customerId) throw new Error('Subscription has no customer.');
  const team = await getTeamByStripeCustomerId(customerId);
  if (!team) {
    if (eventSubscription.metadata?.reachardTeamId) throw new Error('Subscription is awaiting account mapping.');
    return;
  }
  await db.transaction(async tx => {
    const [currentTeam] = await tx.select().from(teams).where(eq(teams.id, team.id)).for('update');
    if (currentTeam.stripeSubscriptionId && currentTeam.stripeSubscriptionId !== eventSubscription.id) return;
    // Event snapshots can arrive out of order; synchronize Stripe's current object.
    const subscription = await stripe.subscriptions.retrieve(eventSubscription.id, { expand: ['items.data.price.product'] });
    const inactive = ['canceled', 'unpaid', 'incomplete_expired'].includes(subscription.status);
    const plan = inactive ? null : await resolveSubscriptionPlan(subscription);
    await tx.update(teams).set({
      stripeSubscriptionId: subscription.id,
      stripeProductId: plan?.productId || currentTeam.stripeProductId,
      planName: plan?.name || null,
      subscriptionStatus: subscription.status, updatedAt: new Date()
    }).where(eq(teams.id, team.id));
  });
}

export async function cancelSubscriptionAtPeriodEnd(subscriptionId: string) {
  if (!subscriptionId) return;
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  if (isTerminalSubscription(subscription.status) || subscription.cancel_at_period_end) return;
  await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
}

export async function resolveSubscriptionPlan(subscription: Stripe.Subscription) {
  const price = subscription.items.data[0]?.price;
  if (!price || subscription.items.data.length !== 1 || subscription.items.data[0].quantity !== 1 || !isMonthlyPrice(price)) {
    throw new Error('Subscription must contain exactly one monthly Reachard membership.');
  }
  const productValue = typeof price.product === 'string'
    ? await stripe.products.retrieve(price.product)
    : price.product;
  const product = requireAvailableProduct(productValue);
  const plan = resolvePurchasedPlan(product.name, price);
  return {
    ...plan,
    priceId: price.id,
    productId: product.id
  };
}

export async function resolveCheckoutPlan(priceId: string) {
  if (!priceId) throw new Error('A valid Reachard price is required.');

  const price = await stripe.prices.retrieve(priceId, { expand: ['product'] });
  const productValue = typeof price.product === 'string'
    ? await stripe.products.retrieve(price.product)
    : price.product;
  const product = requireAvailableProduct(productValue);
  const plan = getReachardPlanByName(product.name);

  if (!plan || !product.active || !price.active || !isMonthlyPrice(price)) {
    throw new Error('This Stripe price is not an active Reachard monthly plan.');
  }

  const canonicalPriceId = await canonicalPriceIdForPlan(plan, product);
  if (price.id !== canonicalPriceId) {
    throw new Error('This Stripe price is not the configured price for this Reachard plan.');
  }

  if (price.currency !== 'usd' || price.unit_amount !== (plan.key === 'base' ? 900 : 1900)) {
    throw new Error('This Stripe price does not match the published Reachard price.');
  }

  // Validate the exact identity through the fulfillment resolver before any
  // checkout session can be created. A new default price with the right
  // amount is not sufficient if a paid invoice would not be recognized.
  const purchasedPlan = resolvePurchasedPlan(product.name, price);
  if (purchasedPlan.entitlementVersion !== ENTITLEMENT_VERSION || purchasedPlan.allowanceMode === 'legacy') {
    throw new Error('This Stripe price is not a current Reachard membership.');
  }

  return {
    ...purchasedPlan,
    priceId: price.id,
    productId: product.id,
    trialPeriodDays: price.recurring?.trial_period_days || 0
  };
}

async function canonicalPriceIdForPlan(plan: ReachardPlan, product: Stripe.Product) {
  if (plan.configuredPriceId) return plan.configuredPriceId;

  const defaultPriceId = typeof product.default_price === 'string'
    ? product.default_price
    : product.default_price?.id;
  if (defaultPriceId) return defaultPriceId;

  const prices = await stripe.prices.list({
    product: product.id,
    active: true,
    type: 'recurring',
    limit: 100
  });
  const monthlyPrices = prices.data.filter((candidate) => isMonthlyPrice(candidate));
  if (monthlyPrices.length !== 1) {
    throw new Error(`Configure STRIPE_${plan.key.toUpperCase()}_PRICE_ID because ${plan.name} has multiple active prices.`);
  }
  return monthlyPrices[0].id;
}

function requireAvailableProduct(product: Stripe.Product | Stripe.DeletedProduct) {
  if ('deleted' in product && product.deleted) {
    throw new Error('The Stripe product for this plan has been deleted.');
  }
  return product as Stripe.Product;
}

export async function getStripePrices() {
  const prices = await stripe.prices.list({
    expand: ['data.product'],
    active: true,
    type: 'recurring',
    limit: 100
  });

  return prices.data.filter(isMonthlyPrice).map((price) => ({
    id: price.id,
    productId:
      typeof price.product === 'string' ? price.product : price.product.id,
    unitAmount: price.unit_amount,
    currency: price.currency,
    metadata: price.metadata,
    interval: price.recurring?.interval,
    trialPeriodDays: price.recurring?.trial_period_days
  }));
}

export async function getStripeProducts() {
  const products = await stripe.products.list({
    active: true,
    expand: ['data.default_price'],
    limit: 100
  });

  return products.data.map((product) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    defaultPriceId:
      typeof product.default_price === 'string'
        ? product.default_price
        : product.default_price?.id
  }));
}
