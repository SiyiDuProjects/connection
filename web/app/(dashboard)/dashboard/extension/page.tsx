'use client';

import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type ExtensionData = {
  hasToken: boolean;
  token?: {
    name: string;
    lastUsedAt: string | null;
    createdAt: string;
  } | null;
};

export default function ExtensionPage() {
  const { data, mutate } = useSWR<ExtensionData>('/api/extension-token', fetcher);

  async function revokeToken() {
    await fetch('/api/extension-token', { method: 'DELETE' });
    await mutate();
  }

  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="mb-6 text-lg font-medium lg:text-2xl">Extension</h1>
      <Card>
        <CardHeader>
          <CardTitle>Connection status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-4 text-sm sm:grid-cols-3">
            <StatusItem label="Status" value={data?.hasToken ? 'Connected' : 'Not connected'} />
            <StatusItem label="Created" value={formatDate(data?.token?.createdAt)} />
            <StatusItem label="Last used" value={formatDate(data?.token?.lastUsedAt)} />
          </div>
          <p className="text-sm text-muted-foreground">
            Connect from the Chrome extension options page. The website creates
            a fresh token, revokes any older active token, and sends it directly
            to the extension. Tokens are not displayed here.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={revokeToken}>
              Disconnect extension
            </Button>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function StatusItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-gray-200 p-4">
      <p className="text-xs uppercase tracking-[0.14em] text-gray-500">{label}</p>
      <p className="mt-2 font-medium text-gray-950">{value}</p>
    </div>
  );
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : '-';
}
