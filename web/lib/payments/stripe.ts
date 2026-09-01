import Stripe from 'stripe';
import { redirect } from 'next/navigation';
import { Team } from '@/lib/db/schema';
import {
  getTeamByStripeCustomerId,
  getUser,
  updateTeamSubscription
} from '@/lib/db/queries';
import {
  getReachardPlanByName,
  requireReachardPlanByName,
  type ReachardPlan
} from '@/lib/payments/plans';
import { recordProductEvent } from '@/lib/product-events';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-04-30.basil'
});

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

  const session = await stripe.checkout.sessions.create({
    line_items: [
      {
        price: checkoutPlan.priceId,
        quantity: 1
      }
    ],
    mode: 'subscription',
    success_url: `${process.env.BASE_URL}/api/stripe/checkout?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.BASE_URL}/pricing`,
    customer: team.stripeCustomerId || undefined,
    client_reference_id: user.id.toString(),
    allow_promotion_codes: true,
    subscription_data: checkoutPlan.trialPeriodDays
      ? { trial_period_days: checkoutPlan.trialPeriodDays }
      : undefined
  });

  await recordProductEvent(user.id, 'checkout.started', {
    checkoutSessionId: session.id,
    planName: checkoutPlan.name
  });

  redirect(session.url!);
}

export async function createCustomerPortalSession(team: Team) {
  if (!team.stripeCustomerId || !team.stripeProductId) {
    redirect('/pricing');
  }

  let configuration: Stripe.BillingPortal.Configuration;
  const configurations = await stripe.billingPortal.configurations.list();

  if (configurations.data.length > 0) {
    configuration = configurations.data[0];
  } else {
    const product = await stripe.products.retrieve(team.stripeProductId);
    if (!product.active) {
      throw new Error("Team's product is not active in Stripe");
    }

    const prices = await stripe.prices.list({
      product: product.id,
      active: true
    });
    if (prices.data.length === 0) {
      throw new Error("No active prices found for the team's product");
    }

    configuration = await stripe.billingPortal.configurations.create({
      business_profile: {
        headline: 'Manage your subscription'
      },
      features: {
        subscription_update: {
          enabled: true,
          default_allowed_updates: ['price', 'quantity', 'promotion_code'],
          proration_behavior: 'create_prorations',
          products: [
            {
              product: product.id,
              prices: prices.data.map((price) => price.id)
            }
          ]
        },
        subscription_cancel: {
          enabled: true,
          mode: 'at_period_end',
          cancellation_reason: {
            enabled: true,
            options: [
              'too_expensive',
              'missing_features',
              'switched_service',
              'unused',
              'other'
            ]
          }
        },
        payment_method_update: {
          enabled: true
        }
      }
    });
  }

  return stripe.billingPortal.sessions.create({
    customer: team.stripeCustomerId,
    return_url: `${process.env.BASE_URL}/dashboard`,
    configuration: configuration.id
  });
}

export async function handleSubscriptionChange(
  subscription: Stripe.Subscription
) {
  const customerId = subscription.customer as string;
  const subscriptionId = subscription.id;
  const status = subscription.status;

  const team = await getTeamByStripeCustomerId(customerId);

  if (!team) {
    console.error('Team not found for Stripe customer:', customerId);
    return;
  }

  if (status === 'canceled' || status === 'unpaid' || status === 'incomplete_expired') {
    await updateTeamSubscription(team.id, {
      stripeSubscriptionId: null,
      stripeProductId: null,
      planName: null,
      subscriptionStatus: status
    });
    return;
  }

  const plan = await resolveSubscriptionPlan(subscription);
  await updateTeamSubscription(team.id, {
    stripeSubscriptionId: subscriptionId,
    stripeProductId: plan.productId,
    planName: plan.name,
    subscriptionStatus: status
  });
}

export async function cancelSubscriptionAtPeriodEnd(subscriptionId: string) {
  if (!subscriptionId) return;
  await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
}

export async function resolveSubscriptionPlan(subscription: Stripe.Subscription) {
  const price = subscription.items.data[0]?.price;
  if (!price) throw new Error('Subscription does not contain a price.');
  const productValue = typeof price.product === 'string'
    ? await stripe.products.retrieve(price.product)
    : price.product;
  const product = requireAvailableProduct(productValue);
  const plan = requireReachardPlanByName(product.name);
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

  if (!plan || !product.active || !price.active || price.type !== 'recurring' || price.recurring?.interval !== 'month') {
    throw new Error('This Stripe price is not an active Reachard monthly plan.');
  }

  const canonicalPriceId = await canonicalPriceIdForPlan(plan, product);
  if (price.id !== canonicalPriceId) {
    throw new Error('This Stripe price is not the configured price for this Reachard plan.');
  }

  return {
    ...plan,
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
  const monthlyPrices = prices.data.filter((candidate) => candidate.recurring?.interval === 'month');
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

  return prices.data.map((price) => ({
    id: price.id,
    productId:
      typeof price.product === 'string' ? price.product : price.product.id,
    unitAmount: price.unit_amount,
    currency: price.currency,
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
