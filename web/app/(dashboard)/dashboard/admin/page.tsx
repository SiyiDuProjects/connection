'use client';

import { useMemo, useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/components/language-provider';

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
  const { t, language } = useI18n();

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
      setStatus(payload.error || t('admin.grantError'));
      return;
    }

    setStatus(
      t('admin.grantSuccess', { email: payload.user.email, balance: payload.credits.balance })
    );
    event.currentTarget.reset();
    await mutate();
  }

  if (data?.error) {
    return (
      <section className="flex-1 p-4 lg:p-8">
        <h1 className="page-title mb-6">{t('nav.admin')}</h1>
        <Card>
          <CardContent>
            <p className="secondary">{data.error}</p>
          </CardContent>
        </Card>
      </section>
    );
  }

  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="page-title mb-6">{t('nav.admin')}</h1>

      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <MetricCard label={t('admin.users')} value={data?.summary.totalUsers} />
        <MetricCard label={t('admin.apiCalls')} value={data?.summary.totalApiCalls} />
        <MetricCard label={t('admin.creditsGranted')} value={data?.summary.totalCreditsGranted} />
        <MetricCard label={t('admin.creditsSpent')} value={data?.summary.totalCreditsSpent} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px] mb-8">
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.users')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="flex gap-2 mb-4" onSubmit={searchUsers}>
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('admin.searchEmail')}
              />
              <Button type="submit" variant="outline" className="button-text">{t('admin.search')}</Button>
            </form>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2">{t('admin.email')}</th>
                    <th className="py-2">{t('admin.plan')}</th>
                    <th className="py-2">{t('admin.credits')}</th>
                    <th className="py-2">{t('admin.lastUsed')}</th>
                    <th className="py-2">{t('admin.created')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.users || []).map((user) => (
                    <tr key={user.id} className="border-b">
                      <td className="py-2 pr-4">{user.email}</td>
                      <td className="py-2 pr-4">
                        {user.planName || t('admin.free')}
                        <span className="text-muted-foreground">
                          {' '}({user.subscriptionStatus || t('admin.inactive')})
                        </span>
                      </td>
                      <td className="py-2 pr-4">{user.creditBalance}</td>
                      <td className="py-2 pr-4">{formatDate(user.lastUsedAt, language)}</td>
                      <td className="py-2">{formatDate(user.createdAt, language)}</td>
                    </tr>
                  ))}
                  {!isLoading && !data?.users?.length ? (
                    <tr>
                      <td className="py-6 text-muted-foreground" colSpan={5}>
                        {t('admin.noUsers')}
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
            <CardTitle>{t('admin.grantCredits')}</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={grantCredits}>
              <div>
                <Label htmlFor="email">{t('admin.userEmail')}</Label>
                <Input id="email" name="email" type="email" required />
              </div>
              <div>
                <Label htmlFor="amount">{t('admin.credits')}</Label>
                <Input id="amount" name="amount" type="number" min="1" step="1" required />
              </div>
              <div>
                <Label htmlFor="note">{t('admin.note')}</Label>
                <textarea
                  id="note"
                  name="note"
                  className="value min-h-24 w-full rounded-[8px] border-0 bg-[#f5f5f7] px-4 py-3 outline-none focus-visible:ring-ring/35 focus-visible:ring-[3px]"
                  placeholder={t('admin.notePlaceholder')}
                />
              </div>
              <Button type="submit" className="button-text">{t('admin.grantCredits')}</Button>
              <p className="secondary">{status}</p>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.recentUsage')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2">{t('admin.user')}</th>
                  <th className="py-2">{t('admin.action')}</th>
                  <th className="py-2">{t('admin.credits')}</th>
                  <th className="py-2">{t('admin.status')}</th>
                  <th className="py-2">{t('admin.date')}</th>
                </tr>
              </thead>
              <tbody>
                {(data?.recentUsage || []).map((row) => (
                  <tr key={row.id} className="border-b">
                    <td className="py-2 pr-4">{row.email}</td>
                    <td className="py-2 pr-4">{row.action}</td>
                    <td className="py-2 pr-4">{row.credits}</td>
                    <td className="py-2 pr-4">{row.status}</td>
                    <td className="py-2">{formatDate(row.createdAt, language)}</td>
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
        <p className="page-title">{value ?? '...'}</p>
      </CardContent>
    </Card>
  );
}

function formatDate(value: string | null, language = 'en') {
  if (!value) return language === 'zh' ? '从未' : 'Never';
  return new Date(value).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US');
}
