'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { ArrowRight, CheckCircle2, Circle, Mail, Plug, Search, Settings, Wallet, type LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { customerPortalAction } from '@/lib/payments/actions';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type AccountData = {
  credits: {
    balance: number;
    remaining: number;
    status: string;
    costs: { search: number; reveal: number; draft: number };
  };
  subscription: { planName: string; status: string };
  extension: { connected: boolean; lastUsedAt: string | null };
  onboarding: {
    profile: { complete: boolean; completedFields: number; totalFields: number };
    extension: { connected: boolean; lastUsedAt: string | null };
    linkedIn: { recentSuccessfulSearchAt: string | null };
    draft: { recentSuccessfulDraftAt: string | null };
    billing: { creditsRemaining: number; planName: string; status: string };
  };
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
  const onboarding = data?.onboarding;
  const steps = [
    {
      label: 'Profile',
      detail: onboarding?.profile.complete
        ? 'Preferences ready for drafts'
        : `${onboarding?.profile.completedFields ?? 0}/${onboarding?.profile.totalFields ?? 4} fields complete`,
      complete: Boolean(onboarding?.profile.complete),
      href: '/dashboard/preferences'
    },
    {
      label: 'Browser extension',
      detail: onboarding?.extension.connected ? `Last used ${formatDate(onboarding.extension.lastUsedAt)}` : 'Sign in once from this browser',
      complete: Boolean(onboarding?.extension.connected),
      href: '/dashboard/extension'
    },
    {
      label: 'Open LinkedIn',
      detail: onboarding?.linkedIn.recentSuccessfulSearchAt ? `Search completed ${formatDate(onboarding.linkedIn.recentSuccessfulSearchAt)}` : 'Use the button on a job post',
      complete: Boolean(onboarding?.linkedIn.recentSuccessfulSearchAt),
      href: 'https://www.linkedin.com/jobs/'
    },
    {
      label: 'Find contacts',
      detail: onboarding?.draft.recentSuccessfulDraftAt ? `Draft created ${formatDate(onboarding.draft.recentSuccessfulDraftAt)}` : 'Reveal an email and draft outreach',
      complete: Boolean(onboarding?.draft.recentSuccessfulDraftAt),
      href: '/dashboard/activity'
    }
  ];

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-lg font-medium lg:text-2xl">Launch checklist</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Complete the path from profile setup to a Gmail draft.
          </p>
        </div>
        <Button asChild className="rounded-md">
          <Link href="/dashboard/extension">
            Next step
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-4">
        {steps.map((step) => (
          <Link key={step.label} href={step.href} className="block">
            <Card className="h-full transition-colors hover:bg-gray-50">
              <CardContent className="p-5">
                <div className="mb-4 flex items-center justify-between">
                  {step.complete ? <CheckCircle2 className="h-5 w-5 text-emerald-700" /> : <Circle className="h-5 w-5 text-gray-400" />}
                  <ArrowRight className="h-4 w-4 text-gray-400" />
                </div>
                <p className="font-medium text-gray-950">{step.label}</p>
                <p className="mt-2 text-sm leading-5 text-gray-600">{step.detail}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <CardTitle>Credits and plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-4xl font-semibold">{data?.credits.remaining ?? '...'}</p>
                <p className="text-sm text-muted-foreground">credits remaining on {data?.subscription.planName || 'Free'}</p>
              </div>
              <form action={customerPortalAction}>
                <Button type="submit" variant="outline" className="rounded-md">Manage subscription</Button>
              </form>
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <Cost icon={Search} label="Search contacts" value={data?.credits.costs.search} />
              <Cost icon={Wallet} label="Reveal email" value={data?.credits.costs.reveal} />
              <Cost icon={Mail} label="Gmail draft" value={data?.credits.costs.draft} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Status icon={Plug} label="Extension" value={data?.extension.connected ? 'Signed in' : 'Signed out'} />
            <Status icon={Settings} label="Profile" value={onboarding?.profile.complete ? 'Ready' : 'Needs setup'} />
            <Button asChild variant="outline" className="w-full rounded-md">
              <Link href="/dashboard/extension">Open extension settings</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Recent usage</CardTitle>
        </CardHeader>
        <CardContent>
          {(data?.usage || []).length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2">Action</th>
                    <th className="py-2">Credits</th>
                    <th className="py-2">Status</th>
                    <th className="py-2">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.usage || []).map((row) => (
                    <tr key={row.id} className="border-b">
                      <td className="py-2">{formatAction(row.action)}</td>
                      <td className="py-2">{row.credits}</td>
                      <td className="py-2">{row.status}</td>
                      <td className="py-2">{formatDate(row.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Searches, reveals, and drafts will appear here with credit costs.</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function Cost({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value?: number }) {
  return (
    <div className="border border-gray-200 p-3">
      <Icon className="mb-2 h-4 w-4 text-gray-950" />
      <p className="font-medium text-gray-950">{value ?? '-'} credit</p>
      <p className="text-gray-600">{label}</p>
    </div>
  );
}

function Status({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <Icon className="h-5 w-5 text-gray-500" />
      <div>
        <p className="text-sm font-medium text-gray-950">{value}</p>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
    </div>
  );
}

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString() : 'never';
}

function formatAction(action: string) {
  return action
    .split('.')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
