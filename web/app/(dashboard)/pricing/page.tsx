import { checkoutAction } from '@/lib/payments/actions';
import { Check } from 'lucide-react';
import { getStripePrices, getStripeProducts } from '@/lib/payments/stripe';
import { SubmitButton } from './submit-button';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

type StripePrice = Awaited<ReturnType<typeof getStripePrices>>[number];
type StripeProduct = Awaited<ReturnType<typeof getStripeProducts>>[number];

const planCopy = {
  Base: {
    credits: '100 credits / month',
    audience: 'For focused job searches and a steady shortlist of companies.',
    features: [
      'LinkedIn job contact search',
      'Email reveal and Gmail draft credits',
      'Website-driven extension login',
      'Profile and outreach defaults'
    ]
  },
  Plus: {
    credits: '300 credits / month',
    audience: 'For active outreach across more roles, teams, and markets.',
    features: [
      'Everything in Base',
      'Higher monthly credit allowance',
      'More room for email reveals and drafts',
      'Priority support'
    ]
  }
};

export default async function PricingPage() {
  let prices: StripePrice[] = [];
  let products: StripeProduct[] = [];

  try {
    [prices, products] = await Promise.all([
      getStripePrices(),
      getStripeProducts()
    ]);
  } catch (error) {
    console.error('Could not load Stripe pricing.', error);
  }

  const basePlan = products.find((product) => product.name === 'Base');
  const plusPlan = products.find((product) => product.name === 'Plus');

  const basePrice = prices.find((price) => price.productId === basePlan?.id);
  const plusPrice = prices.find((price) => price.productId === plusPlan?.id);

  return (
    <main className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
      <div className="mb-10 max-w-2xl">
        <h1 className="text-4xl font-semibold tracking-tight text-gray-950">
          Credits for contact search, reveals, and drafts.
        </h1>
        <p className="mt-4 text-gray-600">
          Subscribe once on the website. The extension follows your account
          status and the server deducts credits for every paid action.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <PricingCard
          name={basePlan?.name || 'Base'}
          price={basePrice?.unitAmount}
          interval={basePrice?.interval}
          trialDays={basePrice?.trialPeriodDays}
          priceId={basePrice?.id}
        />
        <PricingCard
          name={plusPlan?.name || 'Plus'}
          price={plusPrice?.unitAmount}
          interval={plusPrice?.interval}
          trialDays={plusPrice?.trialPeriodDays}
          priceId={plusPrice?.id}
        />
      </div>
    </main>
  );
}

function PricingCard({
  name,
  price,
  interval,
  trialDays,
  priceId
}: {
  name: string;
  price?: number | null;
  interval?: string | null;
  trialDays?: number | null;
  priceId?: string;
}) {
  const copy = planCopy[name as keyof typeof planCopy] || planCopy.Base;
  const configured = Boolean(priceId && typeof price === 'number' && interval);

  return (
    <section className="border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-medium text-gray-950">{name}</h2>
          <p className="mt-2 text-sm text-gray-600">{copy.audience}</p>
        </div>
        <p className="rounded-md bg-gray-950 px-3 py-1.5 text-sm font-medium text-white">
          {copy.credits}
        </p>
      </div>
      <p className="mt-7 text-4xl font-medium text-gray-950">
        {configured ? `$${price! / 100}` : 'Configuring'}
        {configured ? <span className="text-base font-normal text-gray-600"> / {interval}</span> : null}
      </p>
      <p className="mt-2 text-sm text-gray-500">
        {configured && trialDays ? `Includes a ${trialDays} day free trial.` : 'Stripe checkout is not available yet.'}
      </p>
      <ul className="mt-7 space-y-3">
        {copy.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-gray-950" />
            <span className="text-sm text-gray-700">{feature}</span>
          </li>
        ))}
      </ul>
      {configured ? (
        <form action={checkoutAction} className="mt-8">
          <input type="hidden" name="priceId" value={priceId} />
          <SubmitButton />
        </form>
      ) : (
        <Button type="button" disabled variant="outline" className="mt-8 w-full rounded-md">
          Configure Stripe price
        </Button>
      )}
    </section>
  );
}
