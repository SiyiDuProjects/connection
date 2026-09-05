import { ResendVerificationForm } from './resend-verification-form';

export default async function VerifyEmailPage({ searchParams }: {
  searchParams: Promise<{ email?: string; error?: string; redirect?: string; priceId?: string; sent?: string; retryAfter?: string }>;
}) {
  const params = await searchParams;
  return <ResendVerificationForm email={params.email || ''} error={params.error}
    redirectTo={params.redirect || ''} priceId={params.priceId || ''}
    initialCooldown={params.sent === '1' ? 60 : Math.min(3600, Math.max(0, Number(params.retryAfter) || 0))}/>;
}
