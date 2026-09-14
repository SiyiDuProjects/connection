export function isBetaUnlimitedUsage() {
  const value = String(process.env.BETA_UNLIMITED_USAGE || '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(value);
}

export function hasMembershipAccess(membership, now = Date.now()) {
  return ['active', 'trialing', 'past_due'].includes(membership?.status)
    && Number(membership?.periodEnd) * 1000 > now;
}

// Unlimited is an entitlement issued for an exact purchased price. A display
// name such as "Plus" is not sufficient: legacy Plus subscriptions are limited.
export function hasUnlimitedAllowance(membership, now = Date.now()) {
  return membership?.allowanceMode === 'unlimited' && hasMembershipAccess(membership, now);
}

export function hasActionAccess(membership, action, balance, now = Date.now()) {
  if (hasMembershipAccess(membership, now)) return true;
  if (membership?.status !== 'free_trial') return false;
  // The third reveal consumes the last credit before the extension asks for
  // its draft. Preserve that draft; searches and further reveals require credit.
  return action === 'email.draft' || Number(balance) > 0;
}
