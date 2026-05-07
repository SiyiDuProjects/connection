'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import useSWR, { mutate } from 'swr';
import { Bolt, Home, LogOut, Settings } from 'lucide-react';
import { signOut } from '@/app/(login)/actions';
import { clearExtensionSessionBeforeSignOut } from '@/components/extension-session-bridge';

type AccountSummary = {
  user?: {
    name: string | null;
    email: string;
  };
  credits?: {
    remaining: number;
  };
  onboarding?: {
    profile?: {
      complete: boolean;
    };
  };
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { data } = useSWR<AccountSummary>('/api/account', fetcher);

  useEffect(() => {
    if (data && data.onboarding && !data.onboarding.profile?.complete) {
      router.replace(`/onboarding?redirect=${encodeURIComponent(pathname || '/dashboard')}`);
    }
  }, [data, pathname, router]);

  async function handleSignOut() {
    await clearExtensionSessionBeforeSignOut();
    await signOut();
    mutate('/api/user');
    router.push('/');
  }

  return (
    <div className="h-screen overflow-hidden bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.10),transparent_40%),#F8FAFC] text-slate-950">
      <header className="h-16 border-b border-slate-200/70 bg-white/72 backdrop-blur-xl">
        <div className="mx-auto flex h-full max-w-[1240px] items-center justify-between gap-5 px-6">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-[8px] transition-shadow hover:shadow-[0_14px_32px_rgba(15,23,42,0.10)]"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-slate-950 text-lg font-semibold text-white">
              G
            </span>
            <span className="text-xl font-semibold text-slate-950">Reachard</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/pricing"
              className="inline-flex h-10 items-center rounded-[8px] border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-950 transition-all hover:shadow-[0_14px_34px_rgba(15,23,42,0.12)]"
            >
              <Bolt className="mr-2 h-4 w-4 text-amber-500" />
              {formatNumber(data?.credits?.remaining)} credits
            </Link>
            <Link
              href="/dashboard/security"
              aria-label="Settings"
              className="hidden h-10 w-10 items-center justify-center rounded-[8px] border border-slate-200 bg-white text-slate-600 transition-all hover:text-slate-950 hover:shadow-[0_14px_34px_rgba(15,23,42,0.12)] sm:inline-flex"
            >
              <Settings className="h-4 w-4" />
            </Link>
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpen((value) => !value)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700 transition-all hover:shadow-[0_14px_34px_rgba(15,23,42,0.12)]"
                aria-label="Account menu"
              >
                {initials(data?.user)}
              </button>
              {open && (
                <div className="absolute right-0 top-12 z-50 w-44 rounded-[8px] border border-slate-200 bg-white p-2 shadow-[0_18px_50px_rgba(15,23,42,0.14)]">
                  <Link
                    href="/dashboard"
                    onClick={() => setOpen(false)}
                    className="flex h-10 items-center rounded-[8px] px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-950"
                  >
                    <Home className="mr-3 h-4 w-4" />
                    Dashboard
                  </Link>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="flex h-10 w-full items-center rounded-[8px] px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-950"
                  >
                    <LogOut className="mr-3 h-4 w-4" />
                    Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {children}
    </div>
  );
}

function displayName(user?: AccountSummary['user']) {
  if (!user) return '';
  return user.name || user.email.split('@')[0];
}

function initials(user?: AccountSummary['user']) {
  const value = displayName(user);
  if (!value) return 'G';
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
