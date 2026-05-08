'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { Bolt, Chrome, Home, LogOut, Settings } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { signOut } from '@/app/(login)/actions';
import {
  ExtensionSessionBridge,
  clearExtensionSessionBeforeSignOut
} from '@/components/extension-session-bridge';
import { useI18n } from '@/components/language-provider';
import { cn } from '@/lib/utils';

type HeaderUser = {
  id?: number;
  name: string | null;
  email: string;
};

type HeaderAccount = {
  user?: HeaderUser;
  credits?: {
    remaining: number;
  };
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const actionClass =
  'inline-flex h-10 items-center justify-center rounded-[8px] px-4 text-sm font-semibold text-slate-700 transition-colors hover:bg-[#f9f9f9] hover:text-slate-950';
const iconActionClass = cn(actionClass, 'w-10 px-0');
const selectedActionClass = 'bg-[#f3f3f3] text-slate-950';

export function AppHeader({
  account,
  showCredits = false,
  hideOnDashboard = false,
  className,
  innerClassName
}: {
  account?: HeaderAccount;
  showCredits?: boolean;
  hideOnDashboard?: boolean;
  className?: string;
  innerClassName?: string;
}) {
  const pathname = usePathname();

  if (hideOnDashboard && pathname.startsWith('/dashboard')) return null;

  return (
    <header className={cn('h-16', className)}>
      <div className={cn('mx-auto flex h-full max-w-[1240px] items-center justify-between gap-5 px-6', innerClassName)}>
        <Link href="/" className="flex cursor-pointer items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-[8px] bg-slate-950 text-lg font-semibold text-white">
            G
          </span>
          <span className="text-xl font-semibold text-slate-950">Reachard</span>
        </Link>

        <HeaderActions account={account} showCredits={showCredits} />
      </div>
    </header>
  );
}

function HeaderActions({
  account,
  showCredits
}: {
  account?: HeaderAccount;
  showCredits: boolean;
}) {
  const { data: userData } = useSWR<HeaderUser | null>(
    account?.user ? null : '/api/user',
    fetcher
  );
  const user = account?.user || userData;

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/sign-in" className={actionClass}>
          Log in
        </Link>
        <Link
          href="/sign-up"
          className={cn(actionClass, 'bg-slate-950 text-white hover:bg-slate-800 hover:text-white')}
        >
          <Chrome className="h-4 w-4" />
          Add to Chrome
        </Link>
      </div>
    );
  }

  return (
    <>
      <ExtensionSessionBridge user={user} />
      <div className="flex items-center gap-2">
        {showCredits ? <CreditsLink value={account?.credits?.remaining} /> : null}
        <SettingsLink />
        <AccountMenu user={user} />
      </div>
    </>
  );
}

function CreditsLink({ value }: { value?: number }) {
  return (
    <Link href="/pricing" className={cn(actionClass, 'text-slate-950')}>
      <Bolt className="h-4 w-4 text-amber-500" />
      {formatNumber(value)} credits
    </Link>
  );
}

function SettingsLink() {
  const pathname = usePathname();
  const active = pathname.startsWith('/dashboard/security');

  return (
    <Link
      href="/dashboard/security"
      aria-label="Settings"
      className={cn(iconActionClass, active && selectedActionClass)}
    >
      <Settings className="h-4 w-4" />
    </Link>
  );
}

function AccountMenu({ user }: { user: HeaderUser }) {
  const router = useRouter();
  const { t } = useI18n();

  async function handleSignOut() {
    await clearExtensionSessionBeforeSignOut();
    await signOut();
    mutate('/api/user');
    router.push('/');
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(iconActionClass, selectedActionClass)}
          aria-label="Account menu"
        >
          <Avatar className="size-8 rounded-[8px]">
            <AvatarImage alt={user.name || ''} />
            <AvatarFallback className="rounded-[8px] bg-transparent text-sm font-semibold text-slate-700">
              {initials(user)}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44 rounded-[8px] border-slate-200 p-2 shadow-[0_18px_50px_rgba(15,23,42,0.14)]">
        <DropdownMenuItem asChild className="h-10 cursor-pointer rounded-[8px] px-3 text-sm font-semibold text-slate-700 focus:bg-[#f9f9f9] focus:text-slate-950">
          <Link href="/dashboard">
            <Home className="mr-2 h-4 w-4" />
            <span>{t('nav.dashboard')}</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="h-10 cursor-pointer rounded-[8px] px-3 text-sm font-semibold text-slate-700 focus:bg-[#f9f9f9] focus:text-slate-950"
          onSelect={(event) => {
            event.preventDefault();
            handleSignOut();
          }}
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>{t('nav.signOut')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function displayName(user?: HeaderUser) {
  if (!user) return '';
  return user.name || user.email.split('@')[0];
}

function initials(user?: HeaderUser) {
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
