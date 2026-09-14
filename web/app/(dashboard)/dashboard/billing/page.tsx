import { getAccountEntitlement, getTeamForUser, getUser } from '@/lib/db/queries';
import { BillingContent } from './billing-content';
import { getFreeTrialStatus } from '@/lib/free-trial';

export default async function BillingPage() {
  const [user, team] = await Promise.all([getUser(), getTeamForUser()]);
  const [trial, allowance] = user ? await Promise.all([getFreeTrialStatus(user.id), getAccountEntitlement(user.id)]) : [null, null];
  return <BillingContent planName={trial ? 'Free trial' : team?.planName || 'No active plan'} status={trial ? 'free_trial' : team?.subscriptionStatus || 'inactive'} trialRemaining={trial?.remaining}
    allowance={trial ? undefined : allowance || undefined}
    hasCustomer={Boolean(team?.stripeCustomerId)} isOwner={Boolean(user && team?.teamMembers.some(member => member.userId === user.id && member.role === 'owner'))} />;
}
