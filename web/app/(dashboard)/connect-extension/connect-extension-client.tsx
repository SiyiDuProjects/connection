'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  const [message, setMessage] = useState('Syncing your website account with the browser extension.');

  const payload = useMemo(
    () => ({
      type: 'CONNECT_EXTENSION_TOKEN',
      token,
      webBaseUrl,
      apiBaseUrl
    }),
    [apiBaseUrl, token, webBaseUrl]
  );

  useEffect(() => {
    if (blockedReason) {
      setState('failed');
      setMessage(blockedReason);
      return;
    }

    if (!extensionId) {
      setState('failed');
      setMessage('The browser extension was not found. Open this page from Chrome with the extension installed.');
      revokePendingToken(tokenId);
      return;
    }

    const runtime = window.chrome?.runtime || window.browser?.runtime;
    if (!runtime?.sendMessage) {
      setState('failed');
      setMessage(
        'Could not reach the extension from this browser tab. Reload the extension, then try again in the same browser.'
      );
      revokePendingToken(tokenId);
      return;
    }

    runtime.sendMessage(extensionId, payload, (response: { ok?: boolean; error?: string } | undefined) => {
      const lastError = runtime.lastError;
      if (lastError || !response?.ok) {
        setState('failed');
        setMessage(response?.error || lastError?.message || 'The extension did not accept the account session.');
        revokePendingToken(tokenId);
        return;
      }

      setState('connected');
      setMessage('Signed in. Return to LinkedIn and start searching.');
    });
  }, [blockedReason, extensionId, payload, tokenId]);

  const Icon = state === 'connected' ? CheckCircle2 : state === 'failed' ? XCircle : Loader2;

  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="border border-gray-200 bg-white p-6 shadow-sm">
        <Icon className={`h-8 w-8 ${state === 'sending' ? 'animate-spin' : ''}`} />
        <h1 className="mt-5 text-2xl font-semibold text-gray-950">
          {state === 'connected'
            ? 'Signed in'
            : state === 'failed'
              ? 'Could not sync account'
              : 'Signing in'}
        </h1>
        <p className="mt-3 text-sm leading-6 text-gray-600">{message}</p>
        {state !== 'sending' ? (
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild className="rounded-md">
              <Link href="/dashboard">Open dashboard</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-md">
              <Link href="https://www.linkedin.com/jobs/">Open LinkedIn jobs</Link>
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

declare global {
  interface Window {
    chrome?: any;
    browser?: any;
  }
}
