'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type AdminOverview = {
  error?: string;
  summary: {
    totalUsers: number;
    totalApiCalls: number;
    totalCreditsGranted: number;
    totalCreditsSpent: number;
  };
  users: {
    id: number;
    email: string;
    createdAt: string;
    planName: string | null;
    subscriptionStatus: string | null;
    creditBalance: number;
    lastUsedAt: string | null;
  }[];
  recentUsage: {
    id: number;
    email: string;
    action: string;
    credits: number;
    status: string;
    createdAt: string;
  }[];
};

export default function AdminPage() {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');

  const overviewUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (query) params.set('search', query);
    return `/api/admin/overview${params.size ? `?${params.toString()}` : ''}`;
  }, [query]);

  const { data, mutate, isLoading } = useSWR<AdminOverview>(overviewUrl, fetcher);

  async function searchUsers(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuery(search.trim());
  }

  async function grantCredits(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('');

    const form = new FormData(event.currentTarget);
    const response = await fetch('/api/admin/credits/grant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.fromEntries(form))
    });
    const payload = await response.json();

    if (!response.ok) {
      setStatus(payload.error || 'Could not grant credits.');
      return;
    }

    setStatus(
      `Added credits to ${payload.user.email}. New balance: ${payload.credits.balance}.`
    );
    event.currentTarget.reset();
    await mutate();
  }

  if (data?.error) {
    return (
      <section className="flex-1 p-4 lg:p-8">
        <h1 className="text-lg lg:text-2xl font-medium mb-6">Admin</h1>
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">{data.error}</p>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="text-lg lg:text-2xl font-medium mb-6">Admin</h1>

      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <MetricCard label="Users" value={data?.summary.totalUsers} />
        <MetricCard label="API calls" value={data?.summary.totalApiCalls} />
        <MetricCard label="Credits granted" value={data?.summary.totalCreditsGranted} />
        <MetricCard label="Credits spent" value={data?.summary.totalCreditsSpent} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px] mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="flex gap-2 mb-4" onSubmit={searchUsers}>
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by email"
              />
              <Button type="submit" variant="outline">Search</Button>
            </form>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2">Email</th>
                    <th className="py-2">Plan</th>
                    <th className="py-2">Credits</th>
                    <th className="py-2">Last used</th>
                    <th className="py-2">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.users || []).map((user) => (
                    <tr key={user.id} className="border-b">
                      <td className="py-2 pr-4">{user.email}</td>
                      <td className="py-2 pr-4">
                        {user.planName || 'Free'}
                        <span className="text-muted-foreground">
                          {' '}({user.subscriptionStatus || 'inactive'})
                        </span>
                      </td>
                      <td className="py-2 pr-4">{user.creditBalance}</td>
                      <td className="py-2 pr-4">{formatDate(user.lastUsedAt)}</td>
                      <td className="py-2">{formatDate(user.createdAt)}</td>
                    </tr>
                  ))}
                  {!isLoading && !data?.users?.length ? (
                    <tr>
                      <td className="py-6 text-muted-foreground" colSpan={5}>
                        No users found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Grant credits</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={grantCredits}>
              <div>
                <Label htmlFor="email">User email</Label>
                <Input id="email" name="email" type="email" required />
              </div>
              <div>
                <Label htmlFor="amount">Credits</Label>
                <Input id="amount" name="amount" type="number" min="1" step="1" required />
              </div>
              <div>
                <Label htmlFor="note">Note</Label>
                <textarea
                  id="note"
                  name="note"
                  className="border-input min-h-24 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  placeholder="Reason for this grant"
                />
              </div>
              <Button type="submit">Grant credits</Button>
              <p className="text-sm text-muted-foreground">{status}</p>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent usage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2">User</th>
                  <th className="py-2">Action</th>
                  <th className="py-2">Credits</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {(data?.recentUsage || []).map((row) => (
                  <tr key={row.id} className="border-b">
                    <td className="py-2 pr-4">{row.email}</td>
                    <td className="py-2 pr-4">{row.action}</td>
                    <td className="py-2 pr-4">{row.credits}</td>
                    <td className="py-2 pr-4">{row.status}</td>
                    <td className="py-2">{formatDate(row.createdAt)}</td>
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

function MetricCard({ label, value }: { label: string; value?: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-semibold">{value ?? '...'}</p>
      </CardContent>
    </Card>
  );
}

function formatDate(value: string | null) {
  if (!value) return 'Never';
  return new Date(value).toLocaleString();
}
