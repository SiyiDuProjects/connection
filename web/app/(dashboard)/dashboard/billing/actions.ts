'use server';

import { redirect } from 'next/navigation';
import { getTeamForUser, getUser } from '@/lib/db/queries';

export async function openBillingPortal(_previous: { error?: string }, _formData: FormData): Promise<{ error?: string }> {
  const user = await getUser();
  if (!user) redirect('/sign-in?redirect=%2Fdashboard%2Fbilling');
  const team = await getTeamForUser();
  if (!team || !team.teamMembers.some(member => member.userId === user.id && member.role === 'owner')) {
    return { error: 'Only the account owner can manage this subscription.' };
  }
  if (!team.stripeCustomerId) return { error: 'There is no billing account yet. View plans to get started.' };
  let url: string;
  try {
    const { createCustomerPortalSession } = await import('@/lib/payments/stripe');
    const portal = await createCustomerPortalSession(team);
    url = portal.url;
  } catch {
    return { error: 'Billing is temporarily unavailable. Please retry, or contact support@reachard.co for help with a payment or cancellation.' };
  }
  redirect(url);
}
