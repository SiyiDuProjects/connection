'use client';
import { BRAND_NAME } from '@/lib/brand';

import { useState } from 'react';
import { BillingContent } from '../dashboard/billing/billing-content';
import Link from 'next/link';
import { DashboardFrame } from '@/components/dashboard-frame';
import { DashboardSidebar } from '../dashboard/dashboard-sidebar';
import { DashboardOverview } from '../dashboard/dashboard-overview';
import SettingsContent from '../dashboard/general/settings-content';
import ProfileEditor from '../dashboard/profile/profile-editor';
import ReferAFriend from '../dashboard/refer-a-friend/refer-a-friend';
import { ExtensionInstallLink } from '@/components/extension-install-link';

const titles: Record<string, string> = {
  '/dashboard': 'Dashboard', '/dashboard/billing': 'Billing',
  '/dashboard/profile': 'My profile', '/dashboard/general': 'Settings',
  '/dashboard/refer-a-friend': 'Refer a Friend'
};

// The same Reachard components used by authenticated routes, without account
// requests or mutations in this public local preview.
export function DashboardPreview({ initialPath = '/dashboard' }: { initialPath?: string }) {
  const [path, setPath] = useState(initialPath);
  return <DashboardFrame title={titles[path] || 'Dashboard'} onNavigate={setPath}
    sidebar={<DashboardSidebar pathname={path} />}
    actions={<ExtensionInstallLink label="Add to Chrome" size="sm" />}>
    {path === '/dashboard/billing' ? <BillingContent preview hasCustomer isOwner planName="Base" status="past_due" /> : path === '/dashboard' ? <DashboardOverview preview /> : path === '/dashboard/refer-a-friend' ? <ReferAFriend preview /> : <>
      <p className="mx-5 mt-4 text-xs text-muted">{BRAND_NAME} preview · <Link href="/sign-in" className="text-accent underline">Sign in</Link> to manage your account.</p>
      {path === '/dashboard/general' ? <SettingsContent preview /> : <ProfileEditor preview />}
    </>}
  </DashboardFrame>;
}
