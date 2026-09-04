import { checkoutAction } from '@/lib/payments/actions';
import { Check } from 'lucide-react';
import { getStripePrices, getStripeProducts } from '@/lib/payments/stripe';
import { SubmitButton } from './submit-button';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Chip } from '@/components/ui/chip';
import { cookies, headers } from 'next/headers';
import { normalizeLanguage, translate, type Language } from '@/lib/i18n';
import { configuredPriceIdForPlan } from '@/lib/payments/plans';

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
  const language = normalizeLanguage((await cookies()).get('language')?.value || (await headers()).get('accept-language'));
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

  const basePlan = findPlanProduct('Base', products, prices);
  const plusPlan = findPlanProduct('Plus', products, prices);

  const basePrice = findPlanPrice(basePlan, prices);
  const plusPrice = findPlanPrice(plusPlan, prices);

  return (
    <main className="mx-auto max-w-5xl bg-background px-4 py-14 text-foreground sm:px-6 lg:px-8">
      <div className="mb-10 max-w-2xl">
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">
          {t('pricing.title')}
        </h1>
        <p className="mt-4 text-base font-medium leading-7 text-muted-foreground">
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
    </main>
  );
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
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">{name}</h2>
          <p className="mt-2 text-sm font-medium leading-5 text-muted-foreground">{t(copy.audienceKey as Parameters<typeof translate>[1])}</p>
        </div>
        <Chip color="accent" variant="soft">
          {t(copy.creditsKey as Parameters<typeof translate>[1])}
        </Chip>
      </div>
      <p className="mt-7 text-4xl font-semibold text-foreground">
        {configured ? `$${price! / 100}` : t('pricing.configuring')}
        {configured ? <span className="text-base font-medium text-muted-foreground"> / {interval}</span> : null}
      </p>
      <p className="mt-2 text-sm font-medium text-muted-foreground">
        {configured
          ? trialDays
            ? t('pricing.trial', { days: trialDays })
            : t('pricing.billedMonthly')
          : t('pricing.unavailable')}
      </p>
      <ul className="mt-7 space-y-3">
        {copy.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span className="text-sm font-medium leading-5 text-foreground">{t(feature as Parameters<typeof translate>[1])}</span>
          </li>
        ))}
      </ul>
      {configured ? (
        <form action={checkoutAction} className="mt-8">
          <input type="hidden" name="priceId" value={priceId} />
          <SubmitButton />
        </form>
      ) : (
        <Button type="button" disabled variant="outline" className="mt-8 w-full">
          {t('pricing.configureStripe')}
        </Button>
      )}
    </Card>
  );
}
