'use server';

import { redirect } from 'next/navigation';
import { getBillingAccount, getUser } from '@/lib/db/queries';

export async function openBillingPortal(_previous: { error?: string }, _formData: FormData): Promise<{ error?: string }> {
  const user = await getUser();
  if (!user) redirect('/sign-in?redirect=%2Fdashboard%2Fbilling');
  const account = await getBillingAccount(user.id);
  if (!account) {
    return { error: 'Billing account is unavailable.' };
  }
  if (!account.stripeCustomerId) return { error: 'There is no billing account yet. View plans to get started.' };
  let url: string;
  try {
    const { createCustomerPortalSession } = await import('@/lib/payments/stripe');
    const portal = await createCustomerPortalSession(account);
    url = portal.url;
  } catch {
    return { error: 'Billing is temporarily unavailable. Please retry, or contact support@reachard.co for help with a payment or cancellation.' };
  }
  redirect(url);
}
