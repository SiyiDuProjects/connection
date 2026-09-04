'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { Bolt, Chrome } from 'lucide-react';
import { buttonVariants } from '@heroui/react';
import { AccountDropdown } from '@/components/ui/account-menu';
import { signOut } from '@/app/(login)/actions';
import {
  ExtensionSessionBridge,
  clearExtensionSessionBeforeSignOut
} from '@/components/extension-session-bridge';
import { cn } from '@/lib/utils';
import { useI18n } from '@/components/language-provider';

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
    <header className={cn('h-16 bg-surface', variant === 'hero' && 'bg-transparent text-white', className)}>
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
              color: 'var(--foreground)'
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
  const { t } = useI18n();
  const { data: userData } = useSWR<HeaderUser | null>(
    account?.user ? null : '/api/user',
    fetcher
  );
  const user = account?.user || userData;
  const actionClass = getActionClass(variant);
  const chromeStoreUrl = String(process.env.NEXT_PUBLIC_CHROME_STORE_URL || '').trim();
  const chromeCta = chromeStoreUrl
    ? { href: chromeStoreUrl, label: t('header.addToChrome'), external: true }
    : { href: '/sign-up', label: t('header.joinPrivateBeta'), external: false };

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/sign-in" className={actionClass}>
          {t('header.logIn')}
        </Link>
        <Link
          href={chromeCta.href}
          target={chromeCta.external ? '_blank' : undefined}
          rel={chromeCta.external ? 'noreferrer' : undefined}
          className={buttonVariants({ variant: 'primary' })}
        >
          <Chrome />
          <span>{chromeCta.label}</span>
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
  const { language, t } = useI18n();
  return (
    <Link href="/pricing" className={cn(getActionClass(variant), variant === 'default' && 'text-foreground')}>
      <Bolt className={cn('h-4 w-4', variant === 'hero' ? 'text-white' : 'text-primary')} />
      {t('header.credits', { count: formatNumber(value, language) })}
    </Link>
  );
}

function AccountMenu({ user, variant }: { user: HeaderUser; variant: HeaderVariant }) {
  const router = useRouter();
  const { t } = useI18n();

  async function handleSignOut() {
    await clearExtensionSessionBeforeSignOut();
    await signOut();
    mutate('/api/user');
    router.push('/');
  }

  return <AccountDropdown initials={initials(user)} labels={{ menu: t('header.accountMenu'), account: t('header.viewAccount'), settings: t('header.settings'), signOut: t('header.logOut') }} onAccount={() => router.push('/dashboard')} onSettings={() => router.push('/dashboard/security')} onSignOut={() => void handleSignOut()} />;
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

function formatNumber(value: number | undefined, language: 'en' | 'zh') {
  return Number.isFinite(Number(value)) ? Number(value).toLocaleString(language === 'zh' ? 'zh-CN' : 'en-US') : '...';
}
