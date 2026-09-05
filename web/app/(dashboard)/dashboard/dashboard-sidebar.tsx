'use client';

import Link from 'next/link';
import { Avatar, Button } from '@heroui/react';
import { Sidebar } from '@heroui-pro/react';
import { CreditCard, Gift, Home, LogOut, Settings2, UserRound } from 'lucide-react';

export type SidebarAccount = {
  user?: { id?: number; name: string | null; email: string };
  settings?: { senderName?: string | null } | null;
  credits?: { remaining: number; unlimited?: boolean };
  subscription?: { planName?: string };
};

const navigation = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/dashboard/profile', label: 'My profile', icon: UserRound },
  { href: '/dashboard/refer-a-friend', label: 'Refer a Friend', icon: Gift },
  { href: '/dashboard/general', label: 'Settings', icon: Settings2 }
];

export function DashboardSidebar({ account, pathname, onSignOut, signingOut }: {
  account?: SidebarAccount;
  pathname: string;
  onSignOut?: () => void;
  signingOut?: boolean;
}) {
  const name = account?.settings?.senderName || account?.user?.name || 'Reachard';
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('');
  function contents(prefix: string) {
    return (
      <>
        <Sidebar.Header>
          <div className="flex min-w-0 items-center gap-3 px-1 py-2">
            <Avatar className="size-9"><Avatar.Image src="/images/brand/reachard-logo-mark.png" alt="Reachard" /><Avatar.Fallback>{initials}</Avatar.Fallback></Avatar>
            <div className="min-w-0"><p className="truncate text-sm font-medium">{name}</p><p className="text-xs text-muted">{account?.user ? 'Your workspace' : 'Your outreach workspace'}</p></div>
          </div>
        </Sidebar.Header>
        <Sidebar.Content>
          <Sidebar.Group>
            <Sidebar.Menu aria-label="Dashboard navigation">
              {navigation.map(({ href, label, icon: Icon }) => (
                <Sidebar.MenuItem key={href} id={`${prefix}${href}`} href={href} textValue={label}
                  isCurrent={pathname === href || (href !== '/dashboard' && pathname.startsWith(`${href}/`))}>
                  <Sidebar.MenuIcon><Icon className="size-4" /></Sidebar.MenuIcon>
                  <Sidebar.MenuLabel>{label}</Sidebar.MenuLabel>
                </Sidebar.MenuItem>
              ))}
            </Sidebar.Menu>
          </Sidebar.Group>
        </Sidebar.Content>
        <Sidebar.Footer>
          <div className="rounded-xl border border-separator bg-surface/60 px-3 py-3">
            {account?.subscription?.planName ? <p className="mb-2 text-sm font-medium">{account.subscription.planName} plan</p> : null}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted">Credits available</span>
              <span className="font-medium tabular-nums">{account?.credits?.unlimited ? 'Unlimited' : account?.credits?.remaining?.toLocaleString('en-US') ?? '—'}</span>
            </div>
            <Link href="/pricing" className="mt-3 flex items-center gap-2 text-sm font-medium hover:underline"><CreditCard className="size-4" />Manage plan</Link>
          </div>
          {account?.user ? <div className="mt-2 flex items-center gap-2.5 px-1 py-2">
            <Avatar size="sm"><Avatar.Fallback>{initials}</Avatar.Fallback></Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{name}</p>
              <p className="truncate text-xs text-muted">{account?.user?.email || 'Reachard account'}</p>
            </div>
            {onSignOut ? <Button isIconOnly size="sm" variant="ghost" aria-label="Log out" isDisabled={signingOut} onPress={onSignOut}><LogOut className="size-4" /></Button> : null}
          </div> : <Link href="/sign-in" className="px-2 py-3 text-sm font-medium">Sign in to Reachard</Link>}
        </Sidebar.Footer>
      </>
    );
  }
  return <><Sidebar>{contents('desktop-')}</Sidebar><Sidebar.Mobile className="reachard-dashboard">{contents('mobile-')}</Sidebar.Mobile></>;
}
