import { Suspense } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { signedInDestination } from '@/lib/auth/entry-destination';
import { Login } from './login';
import { ContinueCheckout } from './continue-checkout';

export type AuthSearchParams = { redirect?: string; priceId?: string; inviteId?: string; ref?: string };

export async function AuthPage({ mode, searchParams }: {
  mode: 'signin' | 'signup'; searchParams: Promise<AuthSearchParams>;
}) {
  const params = await searchParams;
  if (process.env.POSTGRES_URL && (await cookies()).has('session')) {
    const { getUser } = await import('@/lib/db/queries');
    const user = await getUser();
    if (user) {
      // Keep checkout explicit: visiting a prefetched auth URL must not create
      // a Stripe session, but an already signed-in buyer need not sign in again.
      if (params.redirect === 'checkout' && params.priceId) return <ContinueCheckout priceId={params.priceId} />;
      redirect(signedInDestination(params.redirect));
    }
  }
  return <Suspense><Login key={mode} mode={mode} /></Suspense>;
}
