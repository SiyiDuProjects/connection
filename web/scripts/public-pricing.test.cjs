const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');

function pricing(config = {}) {
  const modules = new Map();
  const saved = { base: process.env.STRIPE_BASE_PRICE_ID, plus: process.env.STRIPE_PLUS_PRICE_ID };
  process.env.STRIPE_BASE_PRICE_ID = config.Base || '';
  process.env.STRIPE_PLUS_PRICE_ID = config.Plus || '';
  function load(file) {
    if (modules.has(file)) return modules.get(file).exports;
    const module = { exports: {} }; modules.set(file, module);
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
    } }).outputText;
    new Function('require', 'module', 'exports', source)(
      spec => spec.startsWith('@/') ? load(path.join(root, spec.slice(2) + '.ts')) : require(spec), module, module.exports);
    return module.exports;
  }
  try { return load(path.join(root, 'app/(dashboard)/pricing/pricing-data.ts')).publicPricingPlans; }
  finally {
    if (saved.base === undefined) delete process.env.STRIPE_BASE_PRICE_ID; else process.env.STRIPE_BASE_PRICE_ID = saved.base;
    if (saved.plus === undefined) delete process.env.STRIPE_PLUS_PRICE_ID; else process.env.STRIPE_PLUS_PRICE_ID = saved.plus;
  }
}
const price = (name, overrides = {}) => ({ id: `price_${name}`, productId: `prod_${name}`,
  unitAmount: name === 'Base' ? 900 : 1900, currency: 'usd', interval: 'month', trialPeriodDays: 0, ...overrides });
const product = (name, overrides = {}) => ({ id: `prod_${name}`, name, defaultPriceId: `price_${name}`, ...overrides });
const products = [product('Base'), product('Plus')];
const prices = [price('Base'), price('Plus')];
function currentOffers(plans) {
  assert.deepEqual(plans.map(plan => [plan.name, plan.price, plan.currency, plan.interval, plan.credits, plan.unlimited]), [
    ['Base', 900, 'usd', 'month', 50, false], ['Plus', 1900, 'usd', 'month', 0, true]
  ]);
}

test('configured current USD monthly prices expose exactly their approved checkout ids', () => {
  const plans = pricing({ Base: 'price_Base', Plus: 'price_Plus' })(prices, products);
  currentOffers(plans); assert.deepEqual(plans.map(plan => plan.priceId), ['price_Base', 'price_Plus']);
});
test('legacy configured prices cannot advertise or sell current benefits at legacy amounts', () => {
  const legacy = [price('Base', { unitAmount: 800 }), price('Plus', { unitAmount: 1200 })];
  const plans = pricing({ Base: 'price_Base', Plus: 'price_Plus' })(legacy, products);
  currentOffers(plans); assert.deepEqual(plans.map(plan => plan.priceId), [null, null]);
});
test('legacy defaults also fail closed when newer prices exist in the same product', () => {
  const legacy = [price('Base', { unitAmount: 800 }), price('Plus', { unitAmount: 1200 })];
  const current = prices.map(item => ({ ...item, id: item.id + '_current' }));
  const plans = pricing()([...legacy, ...current], products);
  currentOffers(plans); assert.deepEqual(plans.map(plan => plan.priceId), [null, null]);
});
test('matching amounts on unknown default or sole prices remain unavailable without an identity', () => {
  for (const catalog of [products, products.map(item => ({ ...item, defaultPriceId: undefined }))]) {
    const plans = pricing()(prices, catalog);
    currentOffers(plans); assert.deepEqual(plans.map(plan => plan.priceId), [null, null]);
  }
});
test('published price identities and exact current entitlement metadata remain valid without environment overrides', () => {
  const published = ['price_1UFMwl0nhgFoMCt9zFzWNPKB', 'price_1UFMyB0nhgFoMCt9O3DiG8iW'];
  for (const known of [prices.map((item, index) => ({ ...item, id: published[index] })),
    prices.map(item => ({ ...item, metadata: { reachardEntitlementVersion: '2026-09-base50-plus-unlimited' } }))]) {
    for (const defaults of [true, false]) {
      const catalog = products.map((item, index) => ({ ...item, defaultPriceId: defaults ? known[index].id : undefined }));
      const plans = pricing()(known, catalog);
      currentOffers(plans); assert.deepEqual(plans.map(plan => plan.priceId), known.map(item => item.id));
    }
  }
});
test('missing or ambiguous Stripe configuration keeps public prices visible and purchase disabled', () => {
  const noDefaults = products.map(item => ({ ...item, defaultPriceId: undefined }));
  for (const plans of [pricing()([], []), pricing({ Base: 'missing', Plus: 'missing' })(prices, products),
    pricing()([...prices, ...prices.map(item => ({ ...item, id: item.id + '_duplicate' }))], noDefaults)]) {
    currentOffers(plans); assert.deepEqual(plans.map(plan => plan.priceId), [null, null]);
  }
});
test('wrong currency, recurrence, amount or extra trial never exposes a checkout id', () => {
  for (const invalid of [{ currency: 'eur' }, { interval: 'year' }, { unitAmount: null }, { trialPeriodDays: 7 }]) {
    const plans = pricing()(prices.map(item => ({ ...item, ...invalid })), products);
    currentOffers(plans); assert.deepEqual(plans.map(plan => plan.priceId), [null, null]);
  }
});
test('a configured price for the other product cannot cross-assign its benefits', () => {
  const plans = pricing({ Base: 'price_Plus', Plus: 'price_Base' })(prices, products);
  currentOffers(plans); assert.deepEqual(plans.map(plan => plan.priceId), [null, null]);
});
