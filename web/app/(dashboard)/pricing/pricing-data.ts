import type { getStripePrices, getStripeProducts } from '@/lib/payments/stripe';
import { configuredPriceIdForPlan, requireReachardPlanByName } from '@/lib/payments/plans';

type StripePrice = Awaited<ReturnType<typeof getStripePrices>>[number];
type StripeProduct = Awaited<ReturnType<typeof getStripeProducts>>[number];

export function publicPricingPlans(prices: StripePrice[], products: StripeProduct[]) {
  return (['Base', 'Plus'] as const).map((name) => {
    const plan = requireReachardPlanByName(name);
    const amount = name === 'Base' ? 900 : 1900;
    const configuredId = configuredPriceIdForPlan(name);
    const configured = prices.find((price) => price.id === configuredId);
    const product = products.find((product) => product.name === name
      && (!configuredId || product.id === configured?.productId));
    const candidates = prices.filter((price) => price.productId === product?.id && price.interval === 'month');
    const preferredId = configuredId || product?.defaultPriceId;
    const candidate = preferredId
      ? candidates.find((price) => price.id === preferredId)
      : candidates.length === 1 ? candidates[0] : undefined;
    // A legacy/default price must never advertise current benefits or expose
    // a purchase action that checkout will reject. Keep the public offer
    // visible while billing is unavailable or misconfigured.
    const available = candidate?.unitAmount === amount && candidate.currency === 'usd'
      && !candidate.trialPeriodDays;
    return {
      name, credits: plan.monthlyCredits, unlimited: plan.unlimited,
      price: amount, currency: 'usd', interval: 'month', trialDays: 0,
      priceId: available ? candidate.id : null
    };
  });
}
