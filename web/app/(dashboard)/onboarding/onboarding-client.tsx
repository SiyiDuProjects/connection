'use client';

import { useRouter } from 'next/navigation';
import { ProfileForm, type ProfileValues } from '@/components/profile-form';

export function OnboardingClient({ initial, redirectTo }: { initial: ProfileValues; redirectTo: string }) {
  const router = useRouter();
  return <main className="default min-h-screen bg-background px-4 pb-12 pt-24 text-foreground sm:px-6">
    <div className="mx-auto max-w-2xl space-y-6">
      <div><h1 className="text-2xl font-semibold">Build your profile</h1><p className="mt-2 text-sm text-muted">A few details help Reachard write introductions that sound like you.</p></div>
      <ProfileForm initial={initial} onboarding onSaved={() => { router.replace(redirectTo); router.refresh(); }} />
    </div>
  </main>;
}
