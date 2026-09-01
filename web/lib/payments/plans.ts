export type ReachardPlan = {
  key: 'base' | 'plus';
  name: 'Base' | 'Plus';
  monthlyCredits: number;
  configuredPriceId: string;
};

const PLANS: ReachardPlan[] = [
  {
    key: 'base',
    name: 'Base',
    monthlyCredits: positiveInteger(process.env.BASE_MONTHLY_CREDITS, 20),
    configuredPriceId: clean(process.env.STRIPE_BASE_PRICE_ID)
  },
  {
    key: 'plus',
    name: 'Plus',
    monthlyCredits: positiveInteger(process.env.PLUS_MONTHLY_CREDITS, 60),
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

function positiveInteger(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function clean(value: unknown) {
  return String(value || '').trim();
}
