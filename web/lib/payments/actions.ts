'use server';

import { redirect } from 'next/navigation';
import { createCheckoutSession, createCustomerPortalSession } from './stripe';
import { withOwnerTeam } from '@/lib/auth/middleware';
import { getUser } from '@/lib/db/queries';

const authenticatedCheckout = withOwnerTeam(async (formData, team) => {
  const priceId = formData.get('priceId') as string;
  await createCheckoutSession({ team: team, priceId });
});

export async function checkoutAction(formData: FormData) {
  if (!await getUser()) {
    const priceId = String(formData.get('priceId') || '');
    redirect(`/sign-up?redirect=checkout&priceId=${encodeURIComponent(priceId)}`);
  }
  return authenticatedCheckout(formData);
}

export const customerPortalAction = withOwnerTeam(async (_, team) => {
  const portalSession = await createCustomerPortalSession(team);
  redirect(portalSession.url);
});
