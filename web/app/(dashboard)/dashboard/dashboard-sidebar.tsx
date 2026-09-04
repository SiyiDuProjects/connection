'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type React from 'react';
import { Copy, Sparkles } from 'lucide-react';
import { Avatar, Button, Card, buttonVariants } from '@heroui/react';
import { useI18n } from '@/components/language-provider';

type SidebarAccount = {
  user?: {
    name: string | null;
    email: string;
  };
  settings?: {
    senderName?: string | null;
    school?: string | null;
    region?: string | null;
  } | null;
  credits?: {
    remaining: number;
  };
};

export function DashboardSidebar({
  account,
  inviteCopying,
  inviteStatus,
  onCopyInviteLink
}: {
  account?: SidebarAccount;
  inviteCopying: boolean;
  inviteStatus: string;
  onCopyInviteLink: () => void;
}) {
  const pathname = usePathname();
  const { language, t } = useI18n();
  const settings = account?.settings;
  const name = settings?.senderName || account?.user?.name || displayName(account?.user, t('sidebar.reachardUser'));
  const email = account?.user?.email || '';

  return (
    <aside className="flex min-h-0 flex-col gap-3">
      <section className="bg-transparent px-2 pb-5 pt-3">
        <div>
          <Avatar size="lg"><Avatar.Fallback>{initialsFromName(name)}</Avatar.Fallback></Avatar>
          <h2 className="mt-5 truncate text-[25px] font-semibold leading-tight text-[#1d1d1f]">{name}</h2>
          {email ? (
            <p className="mt-1 truncate text-[17px] font-medium leading-snug text-[#6e6e73]">{email}</p>
          ) : null}
        </div>

        <nav className="mt-11 flex flex-col gap-5">
          <SidebarNavLink href="/dashboard" active={pathname === '/dashboard'}>
            {t('dashboard.profile')}
          </SidebarNavLink>
          <SidebarNavLink href="/dashboard" active={pathname === '/dashboard'}>
            {t('sidebar.personalInformation')}
          </SidebarNavLink>
          <SidebarNavLink href="/dashboard/recent-outreach" active={pathname === '/dashboard/recent-outreach'}>
            {t('sidebar.recentOutreach')}
          </SidebarNavLink>
          <SidebarNavLink href="/dashboard/security" active={pathname === '/dashboard/security'}>
            {t('sidebar.settings')}
          </SidebarNavLink>
        </nav>
      </section>

      <Card>
        <div className="min-w-0">
          <p className="section-title">{t('dashboard.credits')}</p>
          <p className="page-title mt-1">
            {formatNumber(account?.credits?.remaining, language)}
          </p>
          <p className="secondary mt-1">
            {t('sidebar.creditsHelp')}
          </p>
        </div>
        <Link
          href="/pricing"
          className={buttonVariants({ variant: 'tertiary', fullWidth: true, className: 'mt-3' })}
        >
          {t('sidebar.managePlan')}
        </Link>
      </Card>

      <Card>
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          {t('sidebar.inviteFriends')}
        </div>
        <h2 className="section-title mt-3">
          {t('sidebar.inviteReward')}
        </h2>
        <Button
          type="button"
          onClick={onCopyInviteLink}
          isDisabled={inviteCopying}
          fullWidth variant="secondary" className="mt-4"
        >
          <Copy className="h-4 w-4" aria-hidden="true" />
          {inviteCopying ? t('common.copying') : t('dashboard.copyInviteLink')}
        </Button>
        {inviteStatus ? (
          <p className="secondary mt-2">{inviteStatus}</p>
        ) : null}
      </Card>

    </aside>
  );
}

function SidebarNavLink({
  href,
  active,
  children
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`text-[21px] font-semibold leading-tight tracking-[-0.01em] transition-colors ${
        active
          ? 'text-[#0071e3]'
          : 'text-[#1d1d1f] hover:text-[#0071e3]'
      }`}
    >
      {children}
    </Link>
  );
}

function displayName(user: SidebarAccount['user'] | undefined, fallback: string) {
  if (!user) return fallback;
  return user.name || user.email.split('@')[0];
}

function initialsFromName(value: string) {
  return value
    .split(/[ @.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function formatNumber(value: number | undefined, language: 'en' | 'zh') {
  return Number.isFinite(Number(value)) ? Number(value).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US') : '...';
}
