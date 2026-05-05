import { redirect } from 'next/navigation';
import { getUser } from '@/lib/db/queries';
import { createExtensionToken } from '@/lib/extension-tokens';
import { ConnectExtensionClient } from './connect-extension-client';

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

  const webBaseUrl = process.env.NEXT_PUBLIC_WEB_BASE_URL || process.env.BASE_URL || 'http://localhost:3000';
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8787';
  const blockedReason = getBlockedReason(extensionId);
  const extensionToken = extensionId && !blockedReason
    ? await createExtensionToken(user.id)
    : null;

  return (
    <ConnectExtensionClient
      extensionId={extensionId}
      token={extensionToken?.token || ''}
      tokenId={extensionToken?.tokenId || null}
      webBaseUrl={webBaseUrl.replace(/\/+$/, '')}
      apiBaseUrl={apiBaseUrl.replace(/\/+$/, '')}
      blockedReason={blockedReason}
    />
  );
}

function clean(value: unknown) {
  return String(value || '').trim();
}

function getBlockedReason(extensionId: string) {
  if (!extensionId) return '';

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

function getAllowedExtensionIds() {
  return [
    process.env.ALLOWED_EXTENSION_IDS,
    process.env.CHROME_EXTENSION_ID,
    process.env.NEXT_PUBLIC_CHROME_EXTENSION_ID
  ]
    .filter(Boolean)
    .flatMap((value) => String(value).split(','))
    .map((value) => value.trim())
    .filter(Boolean);
}
