'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { sendExtensionBridgeMessage } from '@/components/extension-session-bridge';

export type ExtensionStatus = 'checking' | 'detected' | 'unconfirmed';

export function useExtensionStatus() {
  const [status, setStatus] = useState<ExtensionStatus>('checking');
  const generation = useRef(0);
  const check = useCallback(async () => {
    const current = ++generation.current;
    setStatus('checking');
    let response = await sendExtensionBridgeMessage({ type: 'GET_EXTENSION_PRESENCE' });
    // Older installed releases do not implement the quick presence handshake.
    if (!response?.ok) response = await sendExtensionBridgeMessage({ type: 'GET_EXTENSION_SESSION_STATUS' });
    if (current === generation.current) setStatus(response?.ok ? 'detected' : 'unconfirmed');
  }, []);
  useEffect(() => {
    void check();
    const onFocus = () => void check();
    window.addEventListener('focus', onFocus);
    const onReady = (event: MessageEvent) => {
      if (event.source === window && event.data?.source === 'reachard-extension-bridge' && event.data.type === 'READY') void check();
    };
    window.addEventListener('message', onReady);
    return () => { generation.current++; window.removeEventListener('focus', onFocus); window.removeEventListener('message', onReady); };
  }, [check]);
  return { status, check };
}
