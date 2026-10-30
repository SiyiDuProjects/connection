// A self-hosted Next.js request URL can contain the internal listener address.
// Public redirects must use the configured website origin behind the tunnel.
export function publicUrl(path: string, requestUrl: string): URL {
  const unifiedProduction = process.env.REACHARD_CONTACTS_ENABLED === '1'
    && process.env.NODE_ENV === 'production';
  if (unifiedProduction && !process.env.BASE_URL) {
    throw new Error('BASE_URL is required for the unified production runtime.');
  }
  return new URL(path, unifiedProduction ? process.env.BASE_URL! : requestUrl);
}
