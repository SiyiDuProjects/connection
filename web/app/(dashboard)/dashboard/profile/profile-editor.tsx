'use client';

import useSWR from 'swr';
import { Alert, Spinner } from '@heroui/react';
import { ProfileForm, type ProfileValues } from '@/components/profile-form';

const fetcher = async (url: string) => {
  const response = await fetch(url);
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error('Your profile could not be loaded. Please refresh and try again.');
  return data as { user: { name: string | null; email: string }; settings: Partial<ProfileValues> | null };
};
const empty: ProfileValues = { name: '', school: '', region: '', senderProfile: '', resumeContext: '', resumeFileName: '', resumeUploadedAt: '', emailTone: 'warm', outreachLength: 'concise', outreachGoal: 'advice', outreachStyleNotes: '', defaultSearchPreferences: {} };

export default function ProfileEditor({ preview = false }: { preview?: boolean }) {
  const { data, error, mutate } = useSWR(preview ? null : '/api/account', fetcher);
  if (error) return <Alert status="danger"><Alert.Indicator /><Alert.Content><Alert.Description>{error.message}</Alert.Description></Alert.Content></Alert>;
  if (!preview && !data) return <div className="flex justify-center p-12"><Spinner aria-label="Loading profile" /></div>;
  const settings = data?.settings;
  const initial = Object.fromEntries(Object.entries({ ...empty, ...settings, name: data?.user.name || '' }).map(([key, value]) => [key, value ?? empty[key as keyof ProfileValues]])) as ProfileValues;
  return <section className="mx-auto w-full max-w-5xl space-y-4 px-5 pb-10 pt-4">
    <div><p className="text-sm text-muted">Your background and preferences for more personal outreach.</p></div>
    <ProfileForm initial={initial} preview={preview} onSaved={() => { void mutate(); }} />
  </section>;
}
