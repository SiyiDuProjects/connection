import type { getStripePrices, getStripeProducts } from '@/lib/payments/stripe';
import { configuredPriceIdForPlan, requireReachardPlanByName } from '@/lib/payments/plans';
import { PricingView } from './pricing-view';
import { checkout } from './checkout';

export const dynamic = 'force-dynamic';

type StripePrice = Awaited<ReturnType<typeof getStripePrices>>[number];
type StripeProduct = Awaited<ReturnType<typeof getStripeProducts>>[number];

export default async function PricingPage() {
  let prices: StripePrice[] = [];
  let products: StripeProduct[] = [];
  const billingConfigured = Boolean(process.env.STRIPE_SECRET_KEY && process.env.POSTGRES_URL);
  if (billingConfigured) {
    try {
      const { getStripePrices, getStripeProducts } = await import('@/lib/payments/stripe');
      [prices, products] = await Promise.all([getStripePrices(), getStripeProducts()]);
    } catch (error) {
      console.error('Could not load Stripe pricing.', error);
    }
  }

  const plans = (['Base', 'Plus'] as const).map((name) => {
    const product = findPlanProduct(name, products, prices);
    const price = findPlanPrice(product, prices);
    return {
      name,
      credits: requireReachardPlanByName(name).monthlyCredits,
      price: price?.unitAmount ?? null,
      currency: price?.currency ?? 'usd',
      interval: price?.interval ?? null,
      trialDays: price?.trialPeriodDays ?? 0,
      priceId: price?.id ?? null
    };
  });
  return <PricingView plans={plans} checkoutAction={billingConfigured ? checkout : undefined} />;
}

function findPlanProduct(name: 'Base' | 'Plus', products: StripeProduct[], prices: StripePrice[]) {
  const configuredPriceId = configuredPriceIdForPlan(name);
  if (configuredPriceId) {
    const configuredPrice = prices.find((price) => price.id === configuredPriceId);
    return products.find(
      (product) => product.id === configuredPrice?.productId && product.name === name
    );
  }
  return products.find((product) => product.name === name);
}

function findPlanPrice(product: StripeProduct | undefined, prices: StripePrice[]) {
  if (!product) return undefined;
  const candidates = prices.filter((price) => price.productId === product.id && price.interval === 'month');
  const configuredPriceId = configuredPriceIdForPlan(product.name);
  if (configuredPriceId) return candidates.find((price) => price.id === configuredPriceId);
  if (product.defaultPriceId) return candidates.find((price) => price.id === product.defaultPriceId);
  return candidates.length === 1 ? candidates[0] : undefined;
}
