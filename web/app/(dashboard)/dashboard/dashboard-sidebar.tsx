'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type React from 'react';
import { Copy, Sparkles } from 'lucide-react';

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
  const email = account?.user?.email || '';

  return (
    <aside className="flex min-h-0 flex-col gap-3">
      <section className="bg-transparent px-2 pb-5 pt-3">
        <div>
          <span className="flex h-24 w-24 items-center justify-center rounded-full bg-[#d8dcdf] text-3xl font-semibold text-[#4b5558]">
            {initialsFromName(name)}
          </span>
          <h2 className="mt-5 truncate text-[25px] font-semibold leading-tight text-[#1d1d1f]">{name}</h2>
          {email ? (
            <p className="mt-1 truncate text-[17px] font-medium leading-snug text-[#6e6e73]">{email}</p>
          ) : null}
        </div>

        <nav className="mt-11 flex flex-col gap-5">
          <SidebarNavLink href="/dashboard" active={pathname === '/dashboard'}>
            Profile
          </SidebarNavLink>
          <SidebarNavLink href="/dashboard" active={pathname === '/dashboard'}>
            Personal Information
          </SidebarNavLink>
          <SidebarNavLink href="/dashboard/recent-outreach" active={pathname === '/dashboard/recent-outreach'}>
            Recent Outreach
          </SidebarNavLink>
          <SidebarNavLink href="/dashboard/security" active={pathname === '/dashboard/security'}>
            Settings
          </SidebarNavLink>
        </nav>
      </section>

      <section className="rounded-[18px] bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.035),0_4px_10px_rgba(0,0,0,0.045)] ring-1 ring-black/[0.025]">
        <div className="min-w-0">
          <p className="section-title">Credits</p>
          <p className="page-title mt-1">
            {formatNumber(account?.credits?.remaining)}
          </p>
          <p className="secondary mt-1">
            Use credits to find contacts and reveal emails.
          </p>
        </div>
        <Link
          href="/pricing"
          className="button-text mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-[8px] bg-white px-3 text-slate-950 transition-colors hover:bg-[#f9f9f9]"
        >
          Manage plan
        </Link>
      </section>

      <section className="rounded-[18px] bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.035),0_4px_10px_rgba(0,0,0,0.045)] ring-1 ring-black/[0.025]">
        <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Invite friends
        </div>
        <h2 className="section-title mt-3">
          Invite a friend to purchase and get one month free.
        </h2>
        <button
          type="button"
          onClick={onCopyInviteLink}
          disabled={inviteCopying}
          className="button-text mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-[#f3f3f3] px-3 text-slate-950 transition-colors hover:bg-[#f9f9f9] disabled:opacity-60"
        >
          <Copy className="h-4 w-4" aria-hidden="true" />
          {inviteCopying ? 'Copying' : 'Copy invite link'}
        </button>
        {inviteStatus ? (
          <p className="secondary mt-2">{inviteStatus}</p>
        ) : null}
      </section>

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
