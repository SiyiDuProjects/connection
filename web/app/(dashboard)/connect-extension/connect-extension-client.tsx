'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { sendExtensionBridgeMessage } from '@/components/extension-session-bridge';
import { useI18n } from '@/components/language-provider';

type ConnectState = 'sending' | 'connected' | 'failed';

export function ConnectExtensionClient({
  extensionId,
  token,
  tokenId,
  webBaseUrl,
  apiBaseUrl,
  blockedReason
}: {
  extensionId: string;
  token: string;
  tokenId: number | null;
  webBaseUrl: string;
  apiBaseUrl: string;
  blockedReason?: string;
}) {
  const [state, setState] = useState<ConnectState>('sending');
  const { language, t } = useI18n();
  const [message, setMessage] = useState(t('connect.syncing'));

  const payload = useMemo(
    () => ({
      type: 'CONNECT_EXTENSION_TOKEN',
      token,
      webBaseUrl,
      apiBaseUrl,
      language
    }),
    [apiBaseUrl, language, token, webBaseUrl]
  );

  useEffect(() => {
    if (blockedReason) {
      setState('failed');
      setMessage(blockedReason);
      return;
    }

    if (!extensionId) {
      setState('failed');
      setMessage(t('connect.notFound'));
      revokePendingToken(tokenId);
      return;
    }

    sendExtensionBridgeMessage({
      type: 'CONNECT_EXTENSION_TOKEN',
      payload
    }, {
      extensionId
    }).then((response) => {
      if (!response?.ok) {
        setState('failed');
        setMessage(response?.error || t('connect.notAccepted'));
        revokePendingToken(tokenId);
        return;
      }

      setState('connected');
      setMessage(t('connect.signedInMessage'));
    });
  }, [blockedReason, extensionId, payload, tokenId, t]);

  const Icon = state === 'connected' ? CheckCircle2 : state === 'failed' ? XCircle : Loader2;

  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="border border-gray-200 bg-white p-6 shadow-sm">
        <Icon className={`h-8 w-8 ${state === 'sending' ? 'animate-spin' : ''}`} />
        <h1 className="mt-5 text-2xl font-semibold text-gray-950">
          {state === 'connected'
            ? t('connect.signedIn')
            : state === 'failed'
              ? t('connect.failed')
              : t('connect.signingIn')}
        </h1>
        <p className="mt-3 text-sm leading-6 text-gray-600">{message}</p>
        {state !== 'sending' ? (
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild className="rounded-md">
              <Link href="/dashboard">{t('connect.openDashboard')}</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-md">
              <Link href="https://www.linkedin.com/jobs/">{t('connect.openLinkedinJobs')}</Link>
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function revokePendingToken(tokenId: number | null) {
  if (!tokenId) return;

  fetch('/api/extension-token', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tokenId })
  }).catch(() => {});
}
