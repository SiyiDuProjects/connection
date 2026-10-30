'use server';

import { redirect } from 'next/navigation';
import { createCheckoutSession, createCustomerPortalSession } from './stripe';
import { withBillingAccount } from '@/lib/auth/middleware';
import { getUser } from '@/lib/db/queries';

const authenticatedCheckout = withBillingAccount(async (formData, account) => {
  const priceId = formData.get('priceId') as string;
  await createCheckoutSession({ account: account, priceId });
});

export async function checkoutAction(formData: FormData) {
  if (!await getUser()) {
    const priceId = String(formData.get('priceId') || '');
    redirect(`/sign-up?redirect=checkout&priceId=${encodeURIComponent(priceId)}`);
  }
  return authenticatedCheckout(formData);
}

export const customerPortalAction = withBillingAccount(async (_, account) => {
  const portalSession = await createCustomerPortalSession(account);
  redirect(portalSession.url);
});
