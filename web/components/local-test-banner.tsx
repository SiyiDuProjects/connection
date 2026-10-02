'use client';
import { useState } from 'react';
import { clearExtensionSessionBeforeSignOut } from './extension-session-bridge';

export function LocalTestBanner() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function reset() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/local-test/reset', { method: 'POST' });
      if (!response.ok) throw new Error('Could not reset this test account.');
      await clearExtensionSessionBeforeSignOut();
      window.location.assign('/sign-up');
    } catch { setError('Reset failed. Try again.'); setBusy(false); }
  }
  return <aside style={{ position: 'fixed', bottom: 8, left: '50%', transform: 'translateX(-50%)', zIndex: 100, padding: '8px 14px', border: '1px solid #b9d7ff', borderRadius: 12, background: '#eff6ff', color: '#154473', fontSize: 12, maxWidth: '95vw', boxShadow: '0 2px 12px #0001' }}>
    Local test · Use any <strong>@reachard.test</strong> email · Sample contacts, no real messages.{' '}
    <button type="button" disabled={busy} onClick={() => void reset()} style={{ textDecoration: 'underline', fontWeight: 600 }}>{busy ? 'Resetting…' : 'Restart registration'}</button>
    {error && <span role="alert"> {error}</span>}
  </aside>;
}
