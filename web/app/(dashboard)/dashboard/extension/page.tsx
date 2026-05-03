'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function ExtensionPage() {
  const { data, mutate } = useSWR<{ hasToken: boolean }>('/api/extension-token', fetcher);
  const [token, setToken] = useState('');
  const [status, setStatus] = useState('');

  async function createToken() {
    const response = await fetch('/api/extension-token', { method: 'POST' });
    const payload = await response.json();
    setToken(payload.token || '');
    setStatus(payload.token ? 'Token created. Paste it into the extension options page now.' : payload.error || 'Could not create token.');
    await mutate();
  }

  async function revokeToken() {
    await fetch('/api/extension-token', { method: 'DELETE' });
    setToken('');
    setStatus('Token revoked.');
    await mutate();
  }

  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium mb-6">Extension</h1>
      <Card>
        <CardHeader>
          <CardTitle>Chrome extension token</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Generate a token for the Chrome extension. It is shown once and can be revoked here.
          </p>
          <p className="text-sm">Status: {data?.hasToken ? 'Connected' : 'No active token'}</p>
          <div className="flex gap-2">
            <Button type="button" onClick={createToken}>Generate token</Button>
            <Button type="button" variant="outline" onClick={revokeToken}>Revoke token</Button>
          </div>
          {token ? (
            <pre className="rounded-md bg-gray-950 text-gray-50 p-4 whitespace-pre-wrap break-all text-sm">
              {token}
            </pre>
          ) : null}
          <p className="text-sm text-muted-foreground">{status}</p>
        </CardContent>
      </Card>
    </section>
  );
}
