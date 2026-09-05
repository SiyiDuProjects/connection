'use client';

import { useState } from 'react';
import Link from 'next/link';
import { DashboardFrame } from '@/components/dashboard-frame';
import { DashboardSidebar } from '../dashboard/dashboard-sidebar';
import { DashboardOverview } from '../dashboard/dashboard-overview';
import SettingsContent from '../dashboard/general/settings-content';
import ProfileEditor from '../dashboard/profile/profile-editor';
import ReferAFriend from '../dashboard/refer-a-friend/refer-a-friend';
import { ExtensionInstallLink } from '@/components/extension-install-link';

const titles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/profile': 'My profile', '/dashboard/general': 'Settings',
  '/dashboard/refer-a-friend': 'Refer a Friend'
};

// The same Reachard components used by authenticated routes, without account
// requests or mutations in this public local preview.
export function DashboardPreview() {
  const [path, setPath] = useState('/dashboard');
  return <DashboardFrame title={titles[path] || 'Dashboard'} onNavigate={setPath}
    sidebar={<DashboardSidebar pathname={path} />}
    actions={<ExtensionInstallLink label="Add to Chrome" size="sm" />}>
    {path === '/dashboard' ? <DashboardOverview preview /> : path === '/dashboard/refer-a-friend' ? <ReferAFriend preview /> : <>
      <p className="mx-5 mt-4 text-xs text-muted">Reachard preview · <Link href="/sign-in" className="text-accent underline">Sign in</Link> to manage your account.</p>
      {path === '/dashboard/general' ? <SettingsContent preview /> : <ProfileEditor preview />}
    </>}
  </DashboardFrame>;
}
