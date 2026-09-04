'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { sendExtensionBridgeMessage } from '@/components/extension-session-bridge';
import { useI18n } from '@/components/language-provider';

type ConnectState = 'sending' | 'connected' | 'failed';

export function ConnectExtensionClient({
  extensionId,
  webBaseUrl,
  apiBaseUrl,
  blockedReason,
  returnTo
}: {
  extensionId: string;
  webBaseUrl: string;
  apiBaseUrl: string;
  blockedReason?: string;
  returnTo?: string;
}) {
  const [state, setState] = useState<ConnectState>('sending');
  const { language, t } = useI18n();
  const [message, setMessage] = useState(t('connect.syncing'));
  const started = useRef(false);

  useEffect(() => {
    if (blockedReason) {
      setState('failed');
      setMessage(blockedReason);
      return;
    }

    if (!extensionId) {
      setState('failed');
      setMessage(t('connect.notFound'));
      return;
    }

    if (started.current) return;
    started.current = true;
    let tokenId: number | null = null;

    async function connect() {
      const tokenResponse = await fetch('/api/extension-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extensionId })
      });
      const tokenPayload = await tokenResponse.json().catch(() => ({}));
      tokenId = Number(tokenPayload.tokenId) || null;
      if (!tokenResponse.ok || !tokenPayload.token) {
        throw new Error(tokenPayload.error || t('connect.notAccepted'));
      }

      const response = await sendExtensionBridgeMessage({
        type: 'CONNECT_EXTENSION_TOKEN',
        payload: {
          type: 'CONNECT_EXTENSION_TOKEN',
          token: tokenPayload.token,
          webBaseUrl,
          apiBaseUrl,
          language,
          returnTo
        }
      }, { extensionId });

      if (!response?.ok) {
        throw new Error(response?.error || t('connect.notAccepted'));
      }

      await recordExtensionConnected();
      setState('connected');
      setMessage(t('connect.signedInMessage'));
    }

    connect().catch((error) => {
      setState('failed');
      setMessage(error instanceof Error ? error.message : t('connect.notAccepted'));
      revokePendingToken(tokenId);
    });
  }, [apiBaseUrl, blockedReason, extensionId, language, returnTo, t, webBaseUrl]);

  const Icon = state === 'connected' ? CheckCircle2 : state === 'failed' ? XCircle : Loader2;

  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="rounded-[8px] bg-white p-6 shadow-sm">
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
            <Button asChild>
              <Link href="/dashboard">{t('connect.openDashboard')}</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="https://www.linkedin.com/jobs/">{t('connect.openLinkedinJobs')}</Link>
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function recordExtensionConnected() {
  return fetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event: 'extension.connected' }),
    keepalive: true
  }).catch(() => undefined);
}

function revokePendingToken(tokenId: number | null) {
  if (!tokenId) return;

  fetch('/api/extension-token', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tokenId })
  }).catch(() => {});
}
