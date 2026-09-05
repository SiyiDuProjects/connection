'use client';

import AccountSettings from './account-settings';
import SecuritySettings from '../security/security-settings';

export default function SettingsContent({ preview = false }: { preview?: boolean }) {
  return <div className="dashboard-page-content">
    <div className="mx-auto max-w-[760px] space-y-6">
      <AccountSettings preview={preview} />
      <SecuritySettings preview={preview} />
    </div>
  </div>;
}
