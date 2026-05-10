'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { Bolt, ChevronDown, Chrome } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { signOut } from '@/app/(login)/actions';
import {
  ExtensionSessionBridge,
  clearExtensionSessionBeforeSignOut
} from '@/components/extension-session-bridge';
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
    <header className={cn('h-16 bg-white', variant === 'hero' && 'bg-transparent text-white', className)}>
      <div
        className={cn(
          'mx-auto flex h-full max-w-[948px] items-center justify-between gap-5 px-6',
          variant !== 'hero' && "relative after:absolute after:bottom-0 after:left-6 after:right-6 after:h-px after:bg-[#d2d2d7] after:content-['']",
          innerClassName
        )}
      >
        <Link href="/" className="flex cursor-pointer items-center gap-3">
          <img
            src="/images/brand/reachard-logo-mark.png"
            alt=""
            aria-hidden="true"
            className="h-10 w-10 shrink-0 object-contain"
          />
          <span
            style={{
              fontFamily: '"Geist", sans-serif',
              fontWeight: 600,
              fontSize: 24,
              letterSpacing: '-0.045em',
              lineHeight: 1,
              color: '#171717'
            }}
          >
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
              : 'bg-[#3a3a3c] text-white hover:bg-[#2c2c2e] hover:text-white'
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

function AccountMenu({ user, variant }: { user: HeaderUser; variant: HeaderVariant }) {
  const router = useRouter();

  async function handleSignOut() {
    await clearExtensionSessionBeforeSignOut();
    await signOut();
    mutate('/api/user');
    router.push('/');
  }

  return (
    <div className="group relative">
      <button
        type="button"
        className={cn(
          'inline-flex h-11 cursor-pointer items-center gap-3 rounded-full px-2 outline-none transition-opacity duration-150 ease-out',
          variant === 'hero' ? 'text-white/85 hover:text-white' : 'text-[#6e6e73] hover:text-[#1d1d1f]'
        )}
        aria-haspopup="menu"
        aria-label="Account menu"
      >
        <ChevronDown className="h-5 w-5 stroke-[2.4]" aria-hidden="true" />
        <Avatar className="size-10 rounded-full">
          <AvatarFallback className="rounded-full bg-[#5ed8bf] text-[17px] font-semibold text-white">
            {initials(user)}
          </AvatarFallback>
        </Avatar>
      </button>
      <div className="absolute right-0 top-full z-50 hidden min-w-[236px] pt-3 group-focus-within:block group-hover:block">
        <div className="overflow-hidden rounded-[12px] border border-[#d2d2d7] bg-white text-left shadow-[0_18px_50px_rgba(0,0,0,0.12)]">
          <Link
            href="/dashboard"
            className="block border-b border-[#e5e5ea] px-7 py-4 text-[17px] font-semibold text-[#6e6e73] transition-colors hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
          >
            View Account
          </Link>
          <Link
            href="/dashboard/security"
            className="block border-b border-[#e5e5ea] px-7 py-4 text-[17px] font-semibold text-[#6e6e73] transition-colors hover:bg-[#f5f5f7] hover:text-[#1d1d1f]"
          >
            Settings
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="block w-full px-7 py-4 text-left text-[17px] font-semibold text-[#d70015] transition-colors hover:bg-[#fff2f2]"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
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
