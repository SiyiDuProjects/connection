'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { Bolt, ChevronDown } from 'lucide-react';
import { buttonVariants } from '@heroui/styles';
import { Avatar, Button, Dropdown, Label } from '@heroui/react';
import { signOut } from '@/app/(login)/actions';
import {
  ExtensionSessionBridge,
  clearExtensionSessionBeforeSignOut
} from '@/components/extension-session-bridge';
import { cn } from '@/lib/utils';
import { translate as t } from '@/lib/i18n';

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
  'nav-link inline-flex min-h-11 items-center justify-center rounded-full px-3 sm:px-4 transition-[background,color,transform] duration-200 ease-out active:scale-[0.98]';

function getActionClass(variant: HeaderVariant) {
  return cn(
    baseActionClass,
    variant === 'hero'
      ? 'text-[#5f6167] hover:bg-white/70 hover:text-[#18181b]'
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
    <header className={cn('default h-16 bg-background', variant === 'hero' && 'bg-transparent text-[#18181b]', className)}>
      <div
        className={cn(
          'mx-auto flex h-full max-w-[948px] items-center justify-between gap-3 px-4 sm:gap-5 sm:px-6',
          variant !== 'hero' && "relative after:absolute after:bottom-0 after:left-6 after:right-6 after:h-px after:bg-[#d2d2d7] after:content-['']",
          innerClassName
        )}
      >
        <Link href="/" className="flex cursor-pointer items-center gap-2 sm:gap-3">
          <img
            src="/images/brand/reachard-logo-mark.png"
            alt=""
            aria-hidden="true"
            className="h-9 w-9 shrink-0 object-contain sm:h-10 sm:w-10"
          />
          <span
            style={{
              fontFamily: '"Geist", sans-serif',
              fontWeight: 600,
              fontSize: 'clamp(20px, 4vw, 24px)',
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
      <div className="flex items-center gap-1 sm:gap-2">
        <Link href="/pricing" className={cn(actionClass, 'hidden sm:inline-flex')}>Pricing</Link>
        <Link href="/sign-in" className={actionClass}>
          {t('header.logIn')}
        </Link>
        <Link
          href="/sign-up"
          className={buttonVariants({ variant: 'primary' })}
        >
          Sign up
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
      <Bolt className={cn('h-4 w-4', variant === 'hero' ? 'text-[#007aff]' : 'text-primary')} />
      {t('header.credits', { count: formatNumber(value) })}
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

  return <Dropdown>
    <Button variant="ghost" aria-label={t('header.accountMenu')}>
      <Avatar size="sm" color="accent"><Avatar.Fallback>{initials(user)}</Avatar.Fallback></Avatar>
      <ChevronDown className="size-4" aria-hidden="true" />
    </Button>
    <Dropdown.Popover className="default">
      <Dropdown.Menu aria-label="Account">
        <Dropdown.Item id="dashboard" href="/dashboard" textValue={t('header.viewAccount')}><Label>{t('header.viewAccount')}</Label></Dropdown.Item>
        <Dropdown.Item id="settings" href="/dashboard/general" textValue={t('header.settings')}><Label>{t('header.settings')}</Label></Dropdown.Item>
        <Dropdown.Item id="sign-out" variant="danger" textValue={t('header.logOut')} onAction={() => void handleSignOut()}><Label>{t('header.logOut')}</Label></Dropdown.Item>
      </Dropdown.Menu>
    </Dropdown.Popover>
  </Dropdown>;
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

function formatNumber(value: number | undefined) {
  return Number.isFinite(Number(value)) ? Number(value).toLocaleString('en-US') : '...';
}
