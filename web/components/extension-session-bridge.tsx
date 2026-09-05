'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

type UserState = {
  id?: number;
  email?: string;
};

type ExtensionMessageResponse = {
  ok?: boolean;
  hasToken?: boolean;
  extensionId?: string;
  error?: string;
};

type ExtensionBridgeOptions = {
  extensionId?: string;
  timeoutMs?: number;
};

export function ExtensionSessionBridge({ user }: { user: UserState | null | undefined }) {
  const syncedUserId = useRef<number | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (pathname.startsWith('/connect-extension') || !user?.id || syncedUserId.current === user.id) return;
    const userId: number = user.id;

    let cancelled = false;

    async function syncExtensionSession() {
      const existing = await sendExtensionBridgeMessage({
        type: 'GET_EXTENSION_SESSION_STATUS'
      });
      if (cancelled) return;
      if (!existing?.ok) return;
      if (existing.hasToken) {
        syncedUserId.current = userId;
        return;
      }

      const extensionId = String(existing.extensionId || '').trim();
      if (!extensionId) return;

      let tokenId: number | null = null;
      try {
        const tokenResponse = await fetch('/api/extension-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ extensionId })
        });
        const tokenPayload = await tokenResponse.json().catch(() => ({}));
        tokenId = Number(tokenPayload.tokenId) || null;
        if (!tokenResponse.ok || !tokenPayload.token) {
          await revokeExtensionToken(tokenId);
          return;
        }
        if (cancelled) {
          await revokeExtensionToken(tokenId);
          return;
        }

        const webBaseUrl = window.location.origin;
        const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
        const apiBaseUrl = String(process.env.NEXT_PUBLIC_API_BASE_URL || '').trim()
          || (isLocal ? 'http://localhost:8787' : 'https://contacts.reachard.co');
        const connected = await sendExtensionBridgeMessage({
          type: 'CONNECT_EXTENSION_TOKEN',
          payload: {
            token: tokenPayload.token,
            webBaseUrl,
            apiBaseUrl
          }
        }, { extensionId });
        if (cancelled || !connected?.ok) {
          await revokeExtensionToken(tokenId);
          return;
        }

        syncedUserId.current = userId;
      } catch (_error) {
        await revokeExtensionToken(tokenId);
      }
    }

    syncExtensionSession().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [pathname, user?.id]);

  return null;
}

function revokeExtensionToken(tokenId: number | null) {
  if (!tokenId) return Promise.resolve();
  return fetch('/api/extension-token', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tokenId })
  }).then(() => undefined).catch(() => undefined);
}

export async function clearExtensionSessionBeforeSignOut() {
  await sendExtensionBridgeMessage({ type: 'CLEAR_EXTENSION_SESSION' });
}

export async function sendExtensionBridgeMessage(
  message: { type: string; payload?: Record<string, unknown> },
  options: ExtensionBridgeOptions = {}
) {
  const bridgeResponse = await sendWindowBridgeMessage(message, options.timeoutMs);
  if (bridgeResponse?.ok || !options.extensionId) return bridgeResponse;

  const directResponse = await sendDirectExtensionMessage(options.extensionId, message, options.timeoutMs);
  return directResponse || bridgeResponse;
}

function sendWindowBridgeMessage(
  message: { type: string; payload?: Record<string, unknown> },
  timeoutMs = 4000
) {
  return new Promise<ExtensionMessageResponse | undefined>((resolve) => {
    const id = `reachard-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const timer = window.setTimeout(() => {
      window.removeEventListener('message', handleResponse);
      resolve(undefined);
    }, timeoutMs);

    function handleResponse(event: MessageEvent) {
      if (event.source !== window) return;
      const data = event.data || {};
      if (data.source !== 'reachard-extension-bridge' || data.id !== id) return;

      window.clearTimeout(timer);
      window.removeEventListener('message', handleResponse);
      resolve(data.response);
    }

    window.addEventListener('message', handleResponse);
    window.postMessage(
      {
        source: 'reachard-web',
        id,
        type: message.type,
        payload: message.payload || {}
      },
      window.location.origin
    );
  });
}

function sendDirectExtensionMessage(
  extensionId: string,
  message: { type: string; payload?: Record<string, unknown> },
  timeoutMs = 4000
) {
  return new Promise<ExtensionMessageResponse | undefined>((resolve) => {
    const runtime = window.chrome?.runtime;
    if (!runtime?.sendMessage) {
      resolve(undefined);
      return;
    }

    let settled = false;
    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve(undefined);
    }, timeoutMs);

    try {
      runtime.sendMessage(extensionId, message, (response: ExtensionMessageResponse | undefined) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        const error = runtime.lastError?.message;
        resolve(response || (error ? { ok: false, error } : undefined));
      });
    } catch (error) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve({
        ok: false,
        error: error instanceof Error ? error.message : 'Could not reach the extension.'
      });
    }
  });
}

declare global {
  interface Window {
    chrome?: {
      runtime?: {
        lastError?: { message?: string };
        sendMessage?: (
          extensionId: string,
          message: { type: string; payload?: Record<string, unknown> },
          callback: (response?: ExtensionMessageResponse) => void
        ) => void;
      };
    };
    browser?: any;
  }
}
