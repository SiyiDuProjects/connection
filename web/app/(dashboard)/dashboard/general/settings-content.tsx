'use client';

import { Separator } from '@heroui/react';
import AccountSettings from './account-settings';
import SecuritySettings from '../security/security-settings';

// Match the supplied Pro SettingsPage's width, spacing and flat row layout.
export default function SettingsContent({ preview = false }: { preview?: boolean }) {
  return <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-5 pb-10 pt-4">
    <p className="text-muted text-sm">Manage your account details and security.</p>
    <Separator />
    <AccountSettings preview={preview} />
    <Separator />
    <SecuritySettings preview={preview} />
  </div>;
}
