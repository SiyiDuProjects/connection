'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type React from 'react';
import { ArrowRight, Clock3, Copy, Sparkles, UserRound } from 'lucide-react';

const buttonShadow = 'transition-all hover:shadow-[0_14px_34px_rgba(15,23,42,0.12)]';

type SidebarAccount = {
  user?: {
    name: string | null;
    email: string;
  };
  settings?: {
    senderName?: string | null;
    school?: string | null;
    region?: string | null;
    targetRole?: string | null;
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
  const settings = account?.settings;
  const name = settings?.senderName || account?.user?.name || displayName(account?.user);
  const targetRoles = settings?.targetRole || 'Add target roles';

  return (
    <aside className="flex min-h-0 flex-col gap-3">
      <section className="rounded-[8px] bg-white p-4 shadow-[0_18px_70px_rgba(15,23,42,0.04)]">
        <div className="text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-[8px] bg-slate-100 text-xl font-semibold text-slate-700">
            {initialsFromName(name)}
          </span>
          <h2 className="mt-2 text-lg font-semibold text-slate-950">{name}</h2>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            {settings?.school || 'Add school or affiliation'}
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-600">
            {settings?.region || 'Add region'}
          </p>
          <p className="mx-auto mt-2 max-w-[210px] text-sm font-semibold leading-5 text-slate-600">
            Interested in <span className="font-semibold text-slate-700">{targetRoles}</span>
          </p>
          <Link
            href="/dashboard#personal-info"
            className={`mt-3 inline-flex min-h-11 items-center rounded-[8px] bg-white px-4 text-sm font-semibold text-slate-950 ${buttonShadow}`}
          >
            Edit profile
          </Link>
        </div>

        <div className="mt-5 border-t border-slate-200 pt-4">
          <p className="text-sm font-semibold text-slate-950">My Career Hub</p>
          <div className="mt-3 space-y-3">
            <CareerHubLink
              href="/dashboard"
              active={pathname === '/dashboard'}
              icon={<UserRound className="h-4 w-4" aria-hidden="true" />}
              title="Profile"
              subtitle="Review your saved context"
            />
            <CareerHubLink
              href="/dashboard/recent-outreach"
              active={pathname === '/dashboard/recent-outreach'}
              icon={<Clock3 className="h-4 w-4" aria-hidden="true" />}
              title="Recent Outreach"
              subtitle="View drafts and unlocked emails"
            />
          </div>
        </div>
      </section>

      <section className="rounded-[8px] bg-white p-3 shadow-[0_18px_70px_rgba(15,23,42,0.04)]">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-950">Credits</p>
          <p className="mt-1 text-xl font-semibold leading-tight text-slate-950">
            {formatNumber(account?.credits?.remaining)}
          </p>
          <p className="mt-1 text-sm font-semibold leading-5 text-slate-600">
            Use credits to find contacts and reveal emails.
          </p>
        </div>
        <Link
          href="/pricing"
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-[8px] bg-white px-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-[#f9f9f9]"
        >
          Manage plan
        </Link>
      </section>

      <section className="rounded-[8px] bg-white p-3 shadow-[0_18px_70px_rgba(15,23,42,0.04)]">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Invite friends
        </div>
        <h2 className="mt-3 text-xl font-semibold leading-tight text-slate-950">
          Invite a friend to purchase and get one month free.
        </h2>
        <button
          type="button"
          onClick={onCopyInviteLink}
          disabled={inviteCopying}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-[#f3f3f3] px-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-[#f9f9f9] disabled:opacity-60"
        >
          <Copy className="h-4 w-4" aria-hidden="true" />
          {inviteCopying ? 'Copying' : 'Copy invite link'}
        </button>
        {inviteStatus ? (
          <p className="mt-2 text-sm font-semibold text-slate-600">{inviteStatus}</p>
        ) : null}
      </section>

    </aside>
  );
}

function CareerHubLink({
  href,
  active,
  icon,
  title,
  subtitle
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-[8px] p-3 transition-colors ${
        active
          ? 'bg-[#f3f3f3] text-slate-950 hover:bg-[#f9f9f9]'
          : 'bg-white text-slate-950 hover:bg-[#f9f9f9]'
      }`}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] bg-white text-slate-700">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block truncate text-sm font-semibold text-slate-600">
          {subtitle}
        </span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-slate-700" aria-hidden="true" />
    </Link>
  );
}

function displayName(user?: SidebarAccount['user']) {
  if (!user) return 'Reachard user';
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

function formatNumber(value?: number) {
  return Number.isFinite(Number(value)) ? Number(value).toLocaleString('en-US') : '...';
}
