'use client';

import useSWR from 'swr';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { customerPortalAction } from '@/lib/payments/actions';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type AccountData = {
  credits: { balance: number };
  subscription: { planName: string; status: string };
  extension: { connected: boolean; lastUsedAt: string | null };
  usage: {
    id: number;
    action: string;
    credits: number;
    status: string;
    createdAt: string;
  }[];
};

export default function DashboardPage() {
  const { data } = useSWR<AccountData>('/api/account', fetcher);

  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium mb-6">Dashboard</h1>
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Credits</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold">{data?.credits.balance ?? '...'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{data?.subscription.planName || 'Free'}</p>
            <p className="text-sm text-muted-foreground">{data?.subscription.status || 'inactive'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Extension</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{data?.extension.connected ? 'Connected' : 'Not connected'}</p>
            <p className="text-sm text-muted-foreground">
              Last used: {data?.extension.lastUsedAt ? new Date(data.extension.lastUsedAt).toLocaleString() : '-'}
            </p>
          </CardContent>
        </Card>
      </div>
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Billing</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={customerPortalAction}>
            <Button type="submit" variant="outline">Manage subscription</Button>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Recent usage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2">Action</th>
                  <th className="py-2">Credits</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {(data?.usage || []).map((row) => (
                  <tr key={row.id} className="border-b">
                    <td className="py-2">{row.action}</td>
                    <td className="py-2">{row.credits}</td>
                    <td className="py-2">{row.status}</td>
                    <td className="py-2">{new Date(row.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
