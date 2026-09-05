'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Card } from '@heroui/react';
import { buttonVariants } from '@heroui/styles';
import { sendExtensionBridgeMessage } from '@/components/extension-session-bridge';
import { translate as t } from '@/lib/i18n';

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
  }, [apiBaseUrl, blockedReason, extensionId, returnTo, webBaseUrl]);

  const Icon = state === 'connected' ? CheckCircle2 : state === 'failed' ? XCircle : Loader2;

  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6 lg:px-8">
      <Card className="p-6">
        <Icon className={`h-8 w-8 ${state === 'sending' ? 'animate-spin' : ''}`} />
        <h1 className="mt-5 text-2xl font-semibold text-foreground">
          {state === 'connected'
            ? t('connect.signedIn')
            : state === 'failed'
              ? t('connect.failed')
              : t('connect.signingIn')}
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">{message}</p>
        {state !== 'sending' ? (
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/dashboard" className={buttonVariants({ variant: 'primary' })}>{t('connect.openDashboard')}</Link>
            <Link href="https://www.linkedin.com/jobs/" className={buttonVariants({ variant: 'secondary' })}>{t('connect.openLinkedinJobs')}</Link>
          </div>
        ) : null}
      </Card>
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
