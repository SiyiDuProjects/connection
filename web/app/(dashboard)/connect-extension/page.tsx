import { redirect } from 'next/navigation';
import { getSettings, getUser } from '@/lib/db/queries';
import { ConnectExtensionClient } from './connect-extension-client';
import { getOnboardingStatus } from '@/lib/onboarding';
import {
  getAllowedExtensionIds,
  isOpenExtensionIdBeta,
  isValidExtensionId
} from '@/lib/extension-id-policy';

export const dynamic = 'force-dynamic';

export default async function ConnectExtensionPage({
  searchParams
}: {
  searchParams: Promise<{ extensionId?: string; return?: string }> | { extensionId?: string; return?: string };
}) {
  const params = await searchParams;
  const extensionId = clean(params.extensionId) || getAllowedExtensionIds()[0] || '';
  const returnTo = clean(params.return);
  const user = await getUser();

  if (!user) {
    const redirectParams = new URLSearchParams();
    if (extensionId) redirectParams.set('extensionId', extensionId);
    if (returnTo) redirectParams.set('return', returnTo);
    const query = redirectParams.toString();
    const redirectTo = `/connect-extension${query ? `?${query}` : ''}`;
    redirect(`/sign-in?redirect=${encodeURIComponent(redirectTo)}`);
  }

  const settings = await getSettings(user.id);
  const onboarding = getOnboardingStatus(user, settings);
  if (!onboarding.complete) {
    const currentParams = new URLSearchParams();
    if (extensionId) currentParams.set('extensionId', extensionId);
    if (returnTo) currentParams.set('return', returnTo);
    const currentPath = `/connect-extension${currentParams.toString() ? `?${currentParams}` : ''}`;
    redirect(`/onboarding?redirect=${encodeURIComponent(currentPath)}`);
  }

  const webBaseUrl = process.env.NEXT_PUBLIC_WEB_BASE_URL || process.env.BASE_URL || 'http://localhost:3000';
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8787';
  const blockedReason = getBlockedReason(extensionId);

  return (
    <ConnectExtensionClient
      extensionId={extensionId}
      webBaseUrl={webBaseUrl.replace(/\/+$/, '')}
      apiBaseUrl={apiBaseUrl.replace(/\/+$/, '')}
      blockedReason={blockedReason}
      returnTo={returnTo}
    />
  );
}

function clean(value: unknown) {
  return String(value || '').trim();
}

function getBlockedReason(extensionId: string) {
  if (!extensionId) return '';
  if (!isValidExtensionId(extensionId)) return 'This is not a valid Chrome extension id.';
  if (isOpenExtensionIdBeta()) return '';

  const allowed = getAllowedExtensionIds();
  if (allowed.length === 0) {
    return process.env.NODE_ENV === 'production'
      ? 'No production Chrome extension id whitelist is configured.'
      : '';
  }

  return allowed.includes(extensionId)
    ? ''
    : 'This Chrome extension id is not allowed to receive account tokens.';
}
