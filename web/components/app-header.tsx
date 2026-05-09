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

type HeaderVariant = 'default' | 'hero';

const baseActionClass =
  'nav-link inline-flex min-h-11 items-center justify-center rounded-full px-4 transition-[background,color,transform] duration-200 ease-out active:scale-[0.98]';

function getActionClass(variant: HeaderVariant) {
  return cn(
    baseActionClass,
    variant === 'hero'
      ? 'text-white/90 hover:bg-white/15 hover:text-white'
      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
  );
}

function getSelectedActionClass(variant: HeaderVariant) {
  return variant === 'hero' ? 'bg-white/15 text-white' : 'bg-secondary text-foreground';
}

export function AppHeader({
  account,
  showCredits = false,
  hideOnDashboard = false,
  variant = 'default',
  className,
  innerClassName
}: {
  account?: HeaderAccount;
  showCredits?: boolean;
  hideOnDashboard?: boolean;
  variant?: HeaderVariant;
  className?: string;
  innerClassName?: string;
}) {
  const pathname = usePathname();

  if (hideOnDashboard && pathname.startsWith('/dashboard')) return null;

  return (
    <header className={cn('h-16 bg-background', variant === 'hero' && 'bg-transparent text-white', className)}>
      <div className={cn('mx-auto flex h-full max-w-[1240px] items-center justify-between gap-5 px-6', innerClassName)}>
        <Link href="/" className="flex cursor-pointer items-center gap-3">
          <span
            className={cn(
              'flex h-9 w-9 items-center justify-center rounded-[11px] text-lg font-semibold',
              variant === 'hero'
                ? 'bg-white/95 text-[#15814e] shadow-[0_12px_30px_rgba(23,129,78,0.2)]'
                : 'bg-primary text-primary-foreground'
            )}
          >
            R
          </span>
          <span className={cn('text-xl font-semibold', variant === 'hero' ? 'text-white' : 'text-foreground')}>
            Reachard
          </span>
        </Link>

        <HeaderActions account={account} showCredits={showCredits} variant={variant} />
      </div>
    </header>
  );
}

function HeaderActions({
  account,
  showCredits,
  variant
}: {
  account?: HeaderAccount;
  showCredits: boolean;
  variant: HeaderVariant;
}) {
  const { data: userData } = useSWR<HeaderUser | null>(
    account?.user ? null : '/api/user',
    fetcher
  );
  const user = account?.user || userData;
  const actionClass = getActionClass(variant);

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/sign-in" className={actionClass}>
          Log in
        </Link>
        <Link
          href="/sign-up"
          className={cn(
            'chrome-cta-button rounded-[10px] transition-[background,color,transform] duration-200 ease-out active:scale-[0.98]',
            variant === 'hero'
              ? 'bg-white text-[#1d1d1f] shadow-[0_14px_30px_rgba(23,129,78,0.14)] hover:bg-white/90 hover:text-[#1d1d1f]'
              : 'bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground'
          )}
        >
          <Chrome />
          <span>Add to Chrome</span>
        </Link>
      </div>
    );
  }

  return (
    <>
      <ExtensionSessionBridge user={user} />
      <div className="flex items-center gap-2">
        {showCredits ? <CreditsLink value={account?.credits?.remaining} variant={variant} /> : null}
        <SettingsLink variant={variant} />
        <AccountMenu user={user} variant={variant} />
      </div>
    </>
  );
}

function CreditsLink({ value, variant }: { value?: number; variant: HeaderVariant }) {
  return (
    <Link href="/pricing" className={cn(getActionClass(variant), variant === 'default' && 'text-foreground')}>
      <Bolt className={cn('h-4 w-4', variant === 'hero' ? 'text-white' : 'text-primary')} />
      {formatNumber(value)} credits
    </Link>
  );
}

function SettingsLink({ variant }: { variant: HeaderVariant }) {
  const pathname = usePathname();
  const active = pathname.startsWith('/dashboard/security');
  const iconActionClass = cn(getActionClass(variant), 'w-11 px-0');

  return (
    <Link
      href="/dashboard/security"
      aria-label="Settings"
      className={cn(iconActionClass, active && getSelectedActionClass(variant))}
    >
      <Settings className="h-4 w-4" />
    </Link>
  );
}

function AccountMenu({ user, variant }: { user: HeaderUser; variant: HeaderVariant }) {
  const router = useRouter();
  const { t } = useI18n();
  const iconActionClass = cn(getActionClass(variant), 'w-11 px-0');

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
          className={cn(iconActionClass, getSelectedActionClass(variant))}
          aria-label="Account menu"
        >
          <Avatar className="size-8 rounded-[11px]">
            <AvatarImage alt={user.name || ''} />
            <AvatarFallback
              className={cn(
                'rounded-[11px] bg-transparent text-sm font-semibold',
                variant === 'hero' ? 'text-white' : 'text-foreground'
              )}
            >
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
