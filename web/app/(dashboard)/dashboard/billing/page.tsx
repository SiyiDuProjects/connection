import { getAccountEntitlement, getBillingAccount, getUser } from '@/lib/db/queries';
import { BillingContent } from './billing-content';
import { getFreeTrialStatus } from '@/lib/free-trial';

export default async function BillingPage() {
  const user = await getUser();
  const account = user ? await getBillingAccount(user.id) : null;
  const [trial, allowance] = user ? await Promise.all([getFreeTrialStatus(user.id), getAccountEntitlement(user.id)]) : [null, null];
  return <BillingContent planName={trial ? 'Free trial' : account?.planName || 'No active plan'} status={trial ? 'free_trial' : account?.subscriptionStatus || 'inactive'} trialRemaining={trial?.remaining}
    allowance={trial ? undefined : allowance || undefined}
    hasCustomer={Boolean(account?.stripeCustomerId)} />;
}
