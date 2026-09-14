export const ENTITLEMENT_VERSION = '2026-09-base50-plus-unlimited';

export type ReachardPlan = {
  key: 'base' | 'plus';
  name: 'Base' | 'Plus';
  monthlyCredits: number;
  unlimited: boolean;
  allowanceMode: 'legacy' | 'monthly' | 'unlimited';
  entitlementVersion: string | null;
  configuredPriceId: string;
};

const PLANS: ReachardPlan[] = [
  {
    key: 'base',
    name: 'Base',
    monthlyCredits: 50,
    unlimited: false,
    allowanceMode: 'monthly',
    entitlementVersion: ENTITLEMENT_VERSION,
    configuredPriceId: clean(process.env.STRIPE_BASE_PRICE_ID)
  },
  {
    key: 'plus',
    name: 'Plus',
    monthlyCredits: 0,
    unlimited: true,
    allowanceMode: 'unlimited',
    entitlementVersion: ENTITLEMENT_VERSION,
    configuredPriceId: clean(process.env.STRIPE_PLUS_PRICE_ID)
  }
];

export function getReachardPlanByName(value: unknown) {
  const name = clean(value).toLowerCase();
  return PLANS.find((plan) => plan.name.toLowerCase() === name) || null;
}

export function requireReachardPlanByName(value: unknown) {
  const plan = getReachardPlanByName(value);
  if (!plan) throw new Error(`Unsupported Reachard plan: ${clean(value) || 'unknown'}`);
  return plan;
}

export function configuredPriceIdForPlan(value: unknown) {
  return getReachardPlanByName(value)?.configuredPriceId || '';
}

// Price identity, not product name, separates current and grandfathered terms.
export function resolvePurchasedPlan(value: unknown, price: {
  id: string; unit_amount: number | null; currency: string;
  metadata?: Record<string, string> | null;
}): ReachardPlan {
  const plan = requireReachardPlanByName(value);
  const publishedPriceId = plan.key === 'base'
    ? 'price_1UFMwl0nhgFoMCt9zFzWNPKB' : 'price_1UFMyB0nhgFoMCt9O3DiG8iW';
  const current = price.id === plan.configuredPriceId || price.id === publishedPriceId
    || price.metadata?.reachardEntitlementVersion === ENTITLEMENT_VERSION;
  if (current) {
    if (price.currency !== 'usd' || price.unit_amount !== (plan.key === 'base' ? 900 : 1900)) {
      throw new Error('Configured Reachard price does not match the published monthly amount.');
    }
    return plan;
  }
  if (price.currency !== 'usd' || price.unit_amount !== (plan.key === 'base' ? 800 : 1200)) {
    throw new Error('Unrecognized Reachard subscription price.');
  }
  return { ...plan, monthlyCredits: plan.key === 'base' ? 20 : 60,
    unlimited: false, allowanceMode: 'legacy', entitlementVersion: null };
}

export function entitlementGrantMetadata(plan: ReachardPlan & { priceId: string }, periodStart: number | undefined, periodEnd: number) {
  if (!Number.isSafeInteger(periodEnd) || (plan.entitlementVersion
    && (!Number.isSafeInteger(periodStart) || periodStart! >= periodEnd))) {
    throw new Error('Subscription billing period is unavailable.');
  }
  return {
    planName: plan.name, priceId: plan.priceId, allowanceMode: plan.allowanceMode,
    monthlyCredits: plan.monthlyCredits, periodStart: periodStart || 0, periodEnd,
    ...(plan.entitlementVersion ? { entitlementVersion: plan.entitlementVersion } : {})
  };
}

function clean(value: unknown) {
  return String(value || '').trim();
}
