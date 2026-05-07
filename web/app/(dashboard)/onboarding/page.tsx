import { redirect } from 'next/navigation';
import { getSettings, getUser } from '@/lib/db/queries';
import { getOnboardingStatus } from '@/lib/onboarding';
import { OnboardingClient } from './onboarding-client';

export const dynamic = 'force-dynamic';

export default async function OnboardingPage({
  searchParams
}: {
  searchParams: Promise<{ redirect?: string }> | { redirect?: string };
}) {
  const params = await searchParams;
  const user = await getUser();
  if (!user) {
    const query = params.redirect ? `?redirect=${encodeURIComponent(`/onboarding?redirect=${encodeURIComponent(params.redirect)}`)}` : '';
    redirect(`/sign-in${query}`);
  }

  const settings = await getSettings(user.id);
  const onboarding = getOnboardingStatus(user, settings);
  const redirectTo = isInternalRedirect(params.redirect) ? params.redirect : '/dashboard';
  if (onboarding.complete) redirect(redirectTo);

  return (
    <OnboardingClient
      initial={{
        name: user.name || '',
        senderName: settings?.senderName || user.name || '',
        region: settings?.region || '',
        school: settings?.school || '',
        targetRole: settings?.targetRole || '',
        senderProfile: settings?.senderProfile || '',
        resumeContext: settings?.resumeContext || '',
        resumeFileName: settings?.resumeFileName || '',
        emailSignature: settings?.emailSignature || '',
        introStyle: normalizeIntroStyle(settings?.introStyle),
        emailTone: normalizeEmailTone(settings?.emailTone),
        outreachLength: normalizeOutreachLength(settings?.outreachLength),
        outreachGoal: normalizeOutreachGoal(settings?.outreachGoal),
        outreachStyleNotes: settings?.outreachStyleNotes || ''
      }}
      redirectTo={redirectTo}
    />
  );
}

function isInternalRedirect(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//');
}

function normalizeIntroStyle(value: unknown) {
  return value === 'career-switcher' || value === 'experienced' || value === 'founder'
    ? value
    : 'student';
}

function normalizeEmailTone(value: unknown) {
  return value === 'concise' || value === 'confident' || value === 'formal'
    ? value
    : 'warm';
}

function normalizeOutreachLength(value: unknown) {
  return value === 'short' || value === 'detailed' ? value : 'concise';
}

function normalizeOutreachGoal(value: unknown) {
  return value === 'referral' || value === 'intro' ? value : 'advice';
}
