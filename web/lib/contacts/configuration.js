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
  return { contactProvider:String(env.CONTACT_PROVIDER || 'treg').toLowerCase(),
    apolloMock:String(env.APOLLO_MOCK || '').toLowerCase()==='true',
    hasApolloKey:Boolean(env.APOLLO_API_KEY), hasHunterKey:Boolean(env.HUNTER_API_KEY),
    hasExploriumKey:Boolean(env.EXPLORIUM_API_KEY), hasRapidApiKey:Boolean(env.RAPIDAPI_KEY), hasTregToken:Boolean(env.TREG_TOKEN) };
}
export function revealProviderName(env = process.env) {
  const status=providerStatus(env);
  return status.apolloMock ? 'mock' : status.contactProvider==='rapidapi' ? 'hunter' : status.contactProvider;
}
export function configurationIssues(env, databaseConfigured) {
  const status=providerStatus(env), issues=[];
  if (!databaseConfigured) issues.push('account_database_not_configured');
  for (const [provider, key] of [['rapidapi','hasRapidApiKey'],['apollo','hasApolloKey'],['explorium','hasExploriumKey'],['treg','hasTregToken']]) {
    if (status.contactProvider===provider && !status[key] && !(provider==='apollo' && status.apolloMock)) issues.push(`${provider}_key_missing`);
  }
  if (status.contactProvider==='rapidapi' && !status.apolloMock && !status.hasHunterKey) issues.push('hunter_key_missing');
  return issues;
}
