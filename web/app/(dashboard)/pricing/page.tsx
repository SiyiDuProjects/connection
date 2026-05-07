import { checkoutAction } from '@/lib/payments/actions';
import { Check } from 'lucide-react';
import { getStripePrices, getStripeProducts } from '@/lib/payments/stripe';
import { SubmitButton } from './submit-button';
import { Button } from '@/components/ui/button';
import { cookies } from 'next/headers';
import { normalizeLanguage, translate, type Language } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

type StripePrice = Awaited<ReturnType<typeof getStripePrices>>[number];
type StripeProduct = Awaited<ReturnType<typeof getStripeProducts>>[number];

const planCopy = {
  Base: {
    creditsKey: 'pricing.baseCredits',
    audienceKey: 'pricing.baseAudience',
    features: [
      'pricing.featureLinkedin',
      'pricing.featureReveal',
      'pricing.featureLogin',
      'pricing.featureProfile'
    ]
  },
  Plus: {
    creditsKey: 'pricing.plusCredits',
    audienceKey: 'pricing.plusAudience',
    features: [
      'pricing.featureEverythingBase',
      'pricing.featureHigherAllowance',
      'pricing.featureMoreRoom',
      'pricing.featurePriority'
    ]
  }
};

export default async function PricingPage() {
  const language = normalizeLanguage((await cookies()).get('language')?.value);
  const t = (key: Parameters<typeof translate>[1], values?: Record<string, string | number>) =>
    translate(language, key, values);
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
    <main className="min-h-screen bg-[#062f2a] px-4 pb-16 pt-28 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
      <div className="mb-10 max-w-2xl">
        <h1 className="text-4xl font-semibold tracking-tight text-white">
          {t('pricing.title')}
        </h1>
        <p className="mt-4 text-emerald-50/70">
          {t('pricing.subtitle')}
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <PricingCard
          name={basePlan?.name || 'Base'}
          price={basePrice?.unitAmount}
          interval={basePrice?.interval}
          trialDays={basePrice?.trialPeriodDays}
          priceId={basePrice?.id}
          language={language}
        />
        <PricingCard
          name={plusPlan?.name || 'Plus'}
          price={plusPrice?.unitAmount}
          interval={plusPrice?.interval}
          trialDays={plusPrice?.trialPeriodDays}
          priceId={plusPrice?.id}
          language={language}
        />
      </div>
      </div>
    </main>
  );
}

function PricingCard({
  name,
  price,
  interval,
  trialDays,
  priceId,
  language
}: {
  name: string;
  price?: number | null;
  interval?: string | null;
  trialDays?: number | null;
  priceId?: string;
  language: Language;
}) {
  const copy = planCopy[name as keyof typeof planCopy] || planCopy.Base;
  const configured = Boolean(priceId && typeof price === 'number' && interval);
  const t = (key: Parameters<typeof translate>[1], values?: Record<string, string | number>) =>
    translate(language, key, values);

  return (
    <section className="rounded-[8px] border border-white/10 bg-white/[0.07] p-6 shadow-[0_24px_80px_rgba(2,44,34,0.18)] backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-medium text-white">{name}</h2>
          <p className="mt-2 text-sm text-emerald-50/66">{t(copy.audienceKey as Parameters<typeof translate>[1])}</p>
        </div>
        <p className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-[#0b3d37]">
          {t(copy.creditsKey as Parameters<typeof translate>[1])}
        </p>
      </div>
      <p className="mt-7 text-4xl font-medium text-white">
        {configured ? `$${price! / 100}` : t('pricing.configuring')}
        {configured ? <span className="text-base font-normal text-emerald-50/62"> / {interval}</span> : null}
      </p>
      <p className="mt-2 text-sm text-emerald-50/54">
        {configured && trialDays ? t('pricing.trial', { days: trialDays }) : t('pricing.unavailable')}
      </p>
      <ul className="mt-7 space-y-3">
        {copy.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#d9b973]" />
            <span className="text-sm text-emerald-50/76">{t(feature as Parameters<typeof translate>[1])}</span>
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
          {t('pricing.configureStripe')}
        </Button>
      )}
    </section>
  );
}
