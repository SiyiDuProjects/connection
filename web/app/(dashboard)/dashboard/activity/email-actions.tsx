'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export function EmailActions({ connected }: { connected: boolean }) {
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  async function syncReplies() {
    setLoading(true);
    setStatus('');
    const response = await fetch('/api/email/sync', { method: 'POST' });
    const payload = await response.json().catch(() => ({}));
    setLoading(false);
    setStatus(response.ok && payload.ok
      ? `Checked ${payload.checked || 0}; found ${payload.replied || 0} replies.`
      : payload.error || 'Could not sync replies.');
  }

  async function disconnect() {
    setLoading(true);
    setStatus('');
    const response = await fetch('/api/email/google/disconnect', { method: 'POST' });
    setLoading(false);
    if (response.ok) window.location.reload();
    else setStatus('Could not disconnect Gmail.');
  }

  if (!connected) {
    return (
      <Button asChild className="rounded-md">
        <a href="/api/email/google/start">Connect Gmail</a>
      </Button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button type="button" className="rounded-md" disabled={loading} onClick={syncReplies}>
        {loading ? 'Syncing...' : 'Sync replies'}
      </Button>
      <Button type="button" variant="outline" className="rounded-md" disabled={loading} onClick={disconnect}>
        Disconnect
      </Button>
      {status ? <p className="text-sm text-muted-foreground">{status}</p> : null}
    </div>
  );
}
