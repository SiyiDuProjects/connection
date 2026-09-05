export function isBetaUnlimitedUsage() {
  const value = String(process.env.BETA_UNLIMITED_USAGE || '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(value);
}

export function hasMembershipAccess(membership, now = Date.now()) {
  return ['active', 'trialing', 'past_due'].includes(membership?.status)
    && Number(membership?.periodEnd) * 1000 > now;
}
