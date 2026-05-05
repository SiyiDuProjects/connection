'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { ArrowRight, CheckCircle2, Circle, FileText, Mail, Plug, Search, Settings, Wallet, type LucideIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { customerPortalAction } from '@/lib/payments/actions';
import { useI18n } from '@/components/language-provider';

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
  const { t, language } = useI18n();
  const onboarding = data?.onboarding;
  const steps = [
    {
      label: t('overview.profile'),
      detail: onboarding?.profile.complete
        ? t('overview.profileReady')
        : t('overview.fieldsComplete', {
            completed: onboarding?.profile.completedFields ?? 0,
            total: onboarding?.profile.totalFields ?? 4
          }),
      complete: Boolean(onboarding?.profile.complete),
      href: '/dashboard/profile'
    },
    {
      label: t('overview.openLinkedin'),
      detail: onboarding?.extension.connected
        ? onboarding?.linkedIn.recentSuccessfulSearchAt
          ? t('overview.searchCompleted', {
              date: formatDate(onboarding.linkedIn.recentSuccessfulSearchAt, language)
            })
          : t('overview.useGaid')
        : t('overview.signInExtension'),
      complete: Boolean(onboarding?.linkedIn.recentSuccessfulSearchAt),
      href: 'https://www.linkedin.com/jobs/'
    },
    {
      label: t('overview.findContacts'),
      detail: onboarding?.draft.recentSuccessfulDraftAt
        ? t('overview.draftCreated', {
            date: formatDate(onboarding.draft.recentSuccessfulDraftAt, language)
          })
        : t('overview.revealAndDraft'),
      complete: Boolean(onboarding?.draft.recentSuccessfulDraftAt),
      href: 'https://www.linkedin.com/jobs/'
    }
  ];

  return (
    <section className="flex-1 p-4 lg:p-8">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-lg font-medium lg:text-2xl">{t('overview.title')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('overview.subtitle')}
          </p>
        </div>
        <Button asChild className="rounded-md">
          <Link href="https://www.linkedin.com/jobs/">
            {t('overview.nextStep')}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-3">
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
            <CardTitle>{t('overview.creditsPlan')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-4xl font-semibold">{data?.credits.remaining ?? '...'}</p>
                <p className="text-sm text-muted-foreground">
                  {t('overview.creditsRemaining', { plan: data?.subscription.planName || 'Free' })}
                </p>
              </div>
              <form action={customerPortalAction}>
                <Button type="submit" variant="outline" className="rounded-md">{t('overview.manageSubscription')}</Button>
              </form>
            </div>
            <div className="grid gap-3 text-sm sm:grid-cols-3">
              <Cost icon={Search} label={t('overview.searchContacts')} value={data?.credits.costs.search} creditLabel={t('overview.creditSingular')} includedLabel={t('overview.included')} />
              <Cost icon={Wallet} label={t('overview.revealEmail')} value={data?.credits.costs.reveal} creditLabel={t('overview.creditSingular')} />
              <Cost icon={Mail} label={t('overview.aiMailDraft')} value={data?.credits.costs.draft} creditLabel={t('overview.creditSingular')} includedLabel={t('overview.included')} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('overview.accountStatus')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Status icon={Plug} label={t('overview.extension')} value={data?.extension.connected ? t('overview.signedIn') : t('overview.signedOut')} />
            <Status icon={Settings} label={t('overview.profileStatus')} value={onboarding?.profile.complete ? t('overview.ready') : t('overview.needsSetup')} />
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              <Button asChild variant="outline" className="w-full rounded-md">
                <Link href="https://www.linkedin.com/jobs/">{t('overview.openLinkedinJobs')}</Link>
              </Button>
              <Button asChild variant="outline" className="w-full rounded-md">
                <Link href="/dashboard/profile">{t('overview.editProfile')}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <Search className="mb-3 h-5 w-5 text-gray-700" />
            <p className="text-2xl font-semibold text-gray-950">{countUsage(data?.usage, 'contacts.search')}</p>
            <p className="text-sm text-gray-600">{t('overview.contactSearches')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <Mail className="mb-3 h-5 w-5 text-gray-700" />
            <p className="text-2xl font-semibold text-gray-950">{countUsage(data?.usage, 'contacts.reveal')}</p>
            <p className="text-sm text-gray-600">{t('overview.emailsRevealed')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <FileText className="mb-3 h-5 w-5 text-gray-700" />
            <p className="text-2xl font-semibold text-gray-950">{countUsage(data?.usage, 'email.draft')}</p>
            <p className="text-sm text-gray-600">{t('overview.aiDraftsCreated')}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>{t('overview.recentUsage')}</CardTitle>
        </CardHeader>
        <CardContent>
          {(data?.usage || []).length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2">{t('overview.action')}</th>
                    <th className="py-2">{t('overview.credits')}</th>
                    <th className="py-2">{t('overview.status')}</th>
                    <th className="py-2">{t('overview.date')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.usage || []).map((row) => (
                    <tr key={row.id} className="border-b">
                      <td className="py-2">{formatAction(row.action)}</td>
                      <td className="py-2">{row.credits}</td>
                      <td className="py-2">{row.status}</td>
                      <td className="py-2">{formatDate(row.createdAt, language)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('overview.emptyUsage')}</p>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

function Cost({
  icon: Icon,
  label,
  value,
  creditLabel,
  includedLabel
}: {
  icon: LucideIcon;
  label: string;
  value?: number;
  creditLabel: string;
  includedLabel?: string;
}) {
  const displayValue = value === 0 && includedLabel ? includedLabel : `${value ?? '-'} ${creditLabel}`;

  return (
    <div className="border border-gray-200 p-3">
      <Icon className="mb-2 h-4 w-4 text-gray-950" />
      <p className="font-medium text-gray-950">{displayValue}</p>
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

function formatDate(value?: string | null, language = 'en') {
  return value
    ? new Date(value).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US')
    : language === 'zh' ? '从未' : 'never';
}

function formatAction(action: string) {
  return action
    .split('.')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function countUsage(usage: AccountData['usage'] | undefined, action: string) {
  return (usage || []).filter((item) => item.action === action && item.status === 'success').length;
}
