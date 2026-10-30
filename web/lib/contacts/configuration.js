export function positiveIntegerEnv(env, name, fallback) {
  const value = Number(env[name] ?? fallback);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer.`);
  return value;
}
export function webBaseUrl(env = process.env) {
  try {
    const url = new URL(env.WEB_BASE_URL || env.BASE_URL || 'https://reachard.co');
    if (['reachard.co','www.reachard.co','localhost','127.0.0.1'].includes(url.hostname)) return url.origin;
  } catch {}
  return 'https://reachard.co';
}
export function providerStatus(env = process.env) {
  return { contactProvider: String(env.CONTACT_PROVIDER || 'treg').toLowerCase(), hasTregToken: Boolean(env.TREG_TOKEN) };
}
export function revealProviderName(env = process.env) {
  return providerStatus(env).contactProvider;
}
export function configurationIssues(env, databaseConfigured) {
  const status = providerStatus(env), issues = [];
  if (!databaseConfigured) issues.push('account_database_not_configured');
  if (!['treg', 'mock'].includes(status.contactProvider)) issues.push('unsupported_contact_provider');
  if (status.contactProvider === 'treg' && !status.hasTregToken) issues.push('treg_key_missing');
  return issues;
}
