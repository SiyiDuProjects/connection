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
  'inline-flex min-h-11 items-center justify-center rounded-full px-4 text-sm font-semibold text-muted-foreground transition-[background,color,transform] duration-200 ease-out hover:bg-secondary hover:text-foreground active:scale-[0.98]';
const iconActionClass = cn(actionClass, 'w-11 px-0');
const selectedActionClass = 'bg-secondary text-foreground';

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
    <header className={cn('h-16 bg-background', className)}>
      <div className={cn('mx-auto flex h-full max-w-[1240px] items-center justify-between gap-5 px-6', innerClassName)}>
        <Link href="/" className="flex cursor-pointer items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-primary text-lg font-semibold text-primary-foreground">
            R
          </span>
          <span className="text-xl font-semibold text-foreground">Reachard</span>
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
          className={cn(actionClass, 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground')}
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
    <Link href="/pricing" className={cn(actionClass, 'text-foreground')}>
      <Bolt className="h-4 w-4 text-primary" />
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
          <Avatar className="size-8 rounded-[11px]">
            <AvatarImage alt={user.name || ''} />
            <AvatarFallback className="rounded-[11px] bg-transparent text-sm font-semibold text-foreground">
              {initials(user)}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem asChild className="cursor-pointer">
          <Link href="/dashboard">
            <Home className="mr-2 h-4 w-4" />
            <span>{t('nav.dashboard')}</span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer"
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
  if (!value) return 'R';
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
