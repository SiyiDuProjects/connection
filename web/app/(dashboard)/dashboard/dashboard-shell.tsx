'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { Alert } from '@heroui/react';
import { usePathname, useRouter } from 'next/navigation';
import useSWR, { mutate } from 'swr';
import { fetchDashboardAccount } from './dashboard-overview';
import { DashboardFrame } from '@/components/dashboard-frame';
import { ExtensionSessionBridge, clearExtensionSessionBeforeSignOut } from '@/components/extension-session-bridge';
import { signOut } from '@/app/(login)/actions';
import { DashboardSidebar, type SidebarAccount } from './dashboard-sidebar';
import { ExtensionInstallLink } from '@/components/extension-install-link';

const titles: Record<string, string> = {
  '/dashboard': 'Dashboard', '/dashboard/recent-outreach': 'Recent activity',
  '/dashboard/general': 'Settings',
  '/dashboard/refer-a-friend': 'Refer a Friend',
  '/dashboard/profile': 'My profile',
  '/dashboard/admin': 'Administration'
};

export function DashboardShell({ account, children }: { account: SidebarAccount; children: ReactNode }) {
  const { data: liveAccount } = useSWR('/api/account', fetchDashboardAccount);
  const pathname = usePathname();
  const router = useRouter();
  const [error, setError] = useState('');
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true); setError('');
    try {
      await clearExtensionSessionBeforeSignOut();
      await signOut();
      await mutate('/api/user', null, false);
      await mutate('/api/account', undefined, false);
      router.push('/'); router.refresh();
    } catch {
      setSigningOut(false); setError('Could not log out. Please try again.');
    }
  }

  return <>
    <ExtensionSessionBridge user={account.user} />
    <DashboardFrame title={titles[pathname] || 'Workspace'}
      sidebar={<DashboardSidebar account={liveAccount || account} pathname={pathname} signingOut={signingOut} onSignOut={() => void handleSignOut()} />}
      actions={<ExtensionInstallLink label="Add to Chrome" size="sm" />}>
      {error ? <Alert status="danger" className="mx-5 mt-4"><Alert.Indicator /><Alert.Content><Alert.Description>{error}</Alert.Description></Alert.Content></Alert> : null}
      {children}
    </DashboardFrame>
  </>;
}
