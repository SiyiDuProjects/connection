'use client';

import useSWR from 'swr';
import { Alert, Button, Spinner } from '@heroui/react';
import { ProfileForm, type ProfileValues } from '@/components/profile-form';

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: 'no-store' });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) throw Object.assign(new Error(response.status === 401
    ? 'Your session has expired. Sign in in another tab, then return here and try again.'
    : 'Your profile could not be loaded. Please try again.'), { status: response.status });
  return data as { user: { id: number; name: string | null; email: string }; settings: Partial<ProfileValues> | null };
};
const empty: ProfileValues = { name: '', school: '', region: '', senderProfile: '', resumeContext: '', resumeFileName: '', resumeUploadedAt: '', emailTone: 'warm', outreachLength: 'concise', outreachGoal: 'advice', outreachStyleNotes: '', defaultSearchPreferences: {} };

export default function ProfileEditor({ preview = false }: { preview?: boolean }) {
  const { data, error, mutate } = useSWR(preview ? null : '/api/account', fetcher);
  const refresh = async () => { try { await mutate(); } catch { /* SWR exposes the failure through error. */ } };
  if (error && !data) return <ProfileLoadError error={error} onRetry={refresh} />;
  if (!preview && !data) return <div className="flex justify-center p-12"><Spinner aria-label="Loading profile" /></div>;
  const settings = data?.settings;
  const initial = Object.fromEntries(Object.entries({ ...empty, ...settings, name: data?.user.name || '' }).map(([key, value]) => [key, value ?? empty[key as keyof ProfileValues]])) as ProfileValues;
  return <section className="mx-auto w-full max-w-5xl space-y-4 px-5 pb-10 pt-4">
    <div><p className="text-sm text-muted">Your background and preferences for more personal outreach.</p></div>
    {error && <ProfileLoadError error={error} onRetry={refresh} hasDraft />}
    <ProfileForm key={data?.user.id ?? 'preview'} initial={initial} preview={preview} onSaved={refresh} />
  </section>;
}

function ProfileLoadError({ error, onRetry, hasDraft = false }: {
  error: Error & { status?: number }; onRetry: () => Promise<void>; hasDraft?: boolean;
}) {
  return <Alert status="danger"><Alert.Indicator /><Alert.Content>
    <Alert.Description>{error.status === 401 ? 'Your session has expired. Sign in in another tab, then return here and try again.' : error.message}{hasDraft && ' Your unsaved edits are still here.'}</Alert.Description>
    {error.status === 401 && <a href="/sign-in?redirect=%2Fdashboard%2Fprofile" target="_blank" rel="noopener noreferrer" className="underline">Sign in in a new tab</a>}
    <Button variant="secondary" onPress={() => { void onRetry(); }}>Try again</Button>
  </Alert.Content></Alert>;
}
