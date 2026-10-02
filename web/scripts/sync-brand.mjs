import { access, readFile } from 'node:fs/promises';

const upstream = new URL('../../scripts/sync-brand.mjs', import.meta.url);
const fullCheckout = await access(upstream).then(() => true, () => false);
if (fullCheckout) {
  await import(upstream.href);
} else {
  // Vercel can upload only web/. Generated constants are committed and checked
  // against the single source by repository CI before a release is prepared.
  const generated = await readFile(new URL('../lib/brand.ts', import.meta.url), 'utf8');
  if (!generated.startsWith('// Generated from brand/brand.json by scripts/sync-brand.mjs.') ||
      !generated.includes('export const BRAND_NAME = ') || !generated.includes('export const BRAND_MARK_PATH = ')) {
    throw new Error('Missing generated brand configuration. Synchronize the full checkout before deploying web/.');
  }
  console.log('Using the generated brand configuration included in this web deployment.');
}
