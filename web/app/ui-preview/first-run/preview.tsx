'use client';

import { useState } from 'react';
import { Button } from '@heroui/react';
import { ProfileForm, type ProfileValues } from '@/components/profile-form';
import { ExtensionWelcomeDialog } from '@/components/extension-welcome';

const empty: ProfileValues = { name: '', school: '', region: '', senderProfile: '', resumeContext: '', resumeFileName: '', resumeUploadedAt: '', outreachLength: 'concise', outreachGoal: 'advice', outreachStyleNotes: '', defaultSearchPreferences: {} };

export function FirstRunPreview() {
  const [open, setOpen] = useState(false);
  return <main className="mx-auto max-w-5xl space-y-6 p-6">
    <p className="text-sm text-muted">Local preview · Profile saving is disabled.</p>
    <h1 className="text-2xl font-semibold">Build your profile</h1>
    <ProfileForm initial={empty} onboarding preview />
    <Button onPress={() => setOpen(true)}>Preview extension welcome</Button>
    <ExtensionWelcomeDialog isOpen={open} onClose={() => setOpen(false)} />
  </main>;
}
