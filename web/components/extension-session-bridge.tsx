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
};

export function ExtensionSessionBridge({ user }: { user: UserState | null | undefined }) {
  const syncedUserId = useRef<number | null>(null);

  useEffect(() => {
    if (!user?.id || syncedUserId.current === user.id) return;
    const userId: number = user.id;

    const runtime = window.chrome?.runtime || window.browser?.runtime;
    if (!runtime?.sendMessage) return;

    let cancelled = false;

    async function syncExtensionSession() {
      const configResponse = await fetch('/api/extension-token');
      if (!configResponse.ok) return;

      const config = (await configResponse.json()) as ExtensionTokenResponse;
      if (cancelled || !config.extensionId) return;

      const existing = await sendExtensionMessage(runtime, config.extensionId, {
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
        if (cancelled || !payload.token || !payload.extensionId) return;

        const connected = await sendExtensionMessage(runtime, payload.extensionId, {
          type: 'CONNECT_EXTENSION_TOKEN',
          token: payload.token,
          webBaseUrl: window.location.origin,
          returnTo: ''
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
  const runtime = window.chrome?.runtime || window.browser?.runtime;
  if (!runtime?.sendMessage) return;

  const response = await fetch('/api/extension-token');
  if (!response.ok) return;

  const payload = (await response.json()) as ExtensionTokenResponse;
  if (!payload.extensionId) return;

  await new Promise<void>((resolve) => {
    runtime.sendMessage(payload.extensionId, { type: 'CLEAR_EXTENSION_SESSION' }, () => resolve());
  });
}

function sendExtensionMessage(
  runtime: any,
  extensionId: string,
  message: Record<string, unknown>
) {
  return new Promise<ExtensionMessageResponse | undefined>((resolve) => {
    runtime.sendMessage(extensionId, message, (response: ExtensionMessageResponse | undefined) => {
      if (runtime.lastError) {
        resolve(undefined);
        return;
      }
      resolve(response);
    });
  });
}

declare global {
  interface Window {
    chrome?: any;
    browser?: any;
  }
}
