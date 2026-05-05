'use client';

import { useEffect, useRef } from 'react';

const SYNC_LOCK_KEY = 'gaid:extension-sync-lock';
const SYNC_LOCK_TTL_MS = 5000;

type UserState = {
  id?: number;
  email?: string;
};

type ExtensionTokenResponse = {
  token?: string;
  extensionId?: string;
};

type ExtensionMessageResponse = {
  ok?: boolean;
  hasToken?: boolean;
  error?: string;
};

export function ExtensionSessionBridge({ user }: { user: UserState | null | undefined }) {
  const syncedUserId = useRef<number | null>(null);

  useEffect(() => {
    if (!user?.id || syncedUserId.current === user.id) return;
    const userId: number = user.id;

    let cancelled = false;

    async function syncExtensionSession() {
      const existing = await sendExtensionBridgeMessage({
        type: 'GET_EXTENSION_SESSION_STATUS'
      });
      if (cancelled) return;
      if (existing?.ok && existing.hasToken) {
        syncedUserId.current = userId;
        return;
      }

      if (!claimSyncLock()) return;

      try {
        const tokenResponse = await fetch('/api/extension-token', { method: 'POST' });
        if (!tokenResponse.ok) return;

        const payload = (await tokenResponse.json()) as ExtensionTokenResponse;
        if (cancelled || !payload.token) return;

        const connected = await sendExtensionBridgeMessage({
          type: 'CONNECT_EXTENSION_TOKEN',
          payload: {
            token: payload.token,
            webBaseUrl: window.location.origin,
            returnTo: ''
          }
        });
        if (connected?.ok) syncedUserId.current = userId;
      } finally {
        releaseSyncLock();
      }
    }

    syncExtensionSession().catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return null;
}

function claimSyncLock() {
  const now = Date.now();
  const existing = Number(window.localStorage.getItem(SYNC_LOCK_KEY) || 0);
  if (Number.isFinite(existing) && now - existing < SYNC_LOCK_TTL_MS) return false;

  window.localStorage.setItem(SYNC_LOCK_KEY, String(now));
  return true;
}

function releaseSyncLock() {
  window.localStorage.removeItem(SYNC_LOCK_KEY);
}

export async function clearExtensionSessionBeforeSignOut() {
  await sendExtensionBridgeMessage({ type: 'CLEAR_EXTENSION_SESSION' });
}

export function sendExtensionBridgeMessage(message: { type: string; payload?: Record<string, unknown> }) {
  return new Promise<ExtensionMessageResponse | undefined>((resolve) => {
    const id = `gaid-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const timer = window.setTimeout(() => {
      window.removeEventListener('message', handleResponse);
      resolve(undefined);
    }, 1000);

    function handleResponse(event: MessageEvent) {
      if (event.source !== window) return;
      const data = event.data || {};
      if (data.source !== 'gaid-extension-bridge' || data.id !== id) return;

      window.clearTimeout(timer);
      window.removeEventListener('message', handleResponse);
      resolve(data.response);
    }

    window.addEventListener('message', handleResponse);
    window.postMessage(
      {
        source: 'gaid-web',
        id,
        type: message.type,
        payload: message.payload || {}
      },
      window.location.origin
    );
  });
}

declare global {
  interface Window {
    chrome?: any;
    browser?: any;
  }
}
