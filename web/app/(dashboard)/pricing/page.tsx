import type { getStripePrices, getStripeProducts } from '@/lib/payments/stripe';
import { publicPricingPlans } from './pricing-data';
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

  const plans = publicPricingPlans(prices, products);
  return <PricingView plans={plans} checkoutAction={billingConfigured ? checkout : undefined} />;
}
