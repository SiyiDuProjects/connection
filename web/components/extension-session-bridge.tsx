'use client';

import { useEffect, useRef } from 'react';
import { normalizeLanguage } from '@/lib/i18n';

const SYNC_LOCK_KEY = 'reachard:extension-sync-lock';
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
  language?: string;
  error?: string;
};

type ExtensionBridgeOptions = {
  extensionId?: string;
  timeoutMs?: number;
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
            language: readWebsiteLanguage(),
            returnTo: ''
          }
        }, {
          extensionId: payload.extensionId
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

function readWebsiteLanguage() {
  const languageCookie = document.cookie
    .split('; ')
    .find((row) => row.startsWith('language='))
    ?.split('=')[1];

  return normalizeLanguage(languageCookie);
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
