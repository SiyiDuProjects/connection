import { getTeamForUser, getUser } from '@/lib/db/queries';
import { BillingContent } from './billing-content';

export default async function BillingPage() {
  const [user, team] = await Promise.all([getUser(), getTeamForUser()]);
  return <BillingContent planName={team?.planName || 'No active plan'} status={team?.subscriptionStatus || 'inactive'}
    hasCustomer={Boolean(team?.stripeCustomerId)} isOwner={Boolean(user && team?.teamMembers.some(member => member.userId === user.id && member.role === 'owner'))} />;
}
