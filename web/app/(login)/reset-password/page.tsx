import type { Metadata } from 'next';
import { BRAND_NAME } from '@/lib/brand';
import { PasswordRecovery } from '../password-recovery';
import '../../auth.css';
import '../../marketing.css';

export const metadata: Metadata = {
  title: `Reset password | ${BRAND_NAME}`,
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export const dynamic = 'force-dynamic';

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const params = await searchParams;
  // A missing token stays on the recovery screen with a clear new-link action.
  const token = typeof params.token === 'string' && params.token ? params.token : 'invalid';
  return <PasswordRecovery token={token} />;
}
