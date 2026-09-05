'use client';

import { useActionState } from 'react';
import { Alert, Button, FieldError, Form, Input, Label, Spinner, TextField } from '@heroui/react';
import { updateAccount } from '@/app/(login)/actions';
import type { PublicUser } from '@/lib/auth/public-user';
import useSWR from 'swr';
import { translate as t } from '@/lib/i18n';
import { SettingsRow } from '@/components/settings-row';

type ActionState = { name?: string; error?: string; success?: string };
const fetcher = async (url: string) => { const response = await fetch(url); if (!response.ok) throw new Error('Could not load your account.'); return response.json(); };

export default function AccountSettings({ preview = false }: { preview?: boolean }) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(updateAccount, {});
  const { data: user, error } = useSWR<PublicUser>(preview ? null : '/api/user', fetcher);
  if (error) return <Alert status="danger"><Alert.Content><Alert.Description>Could not load your account. Please refresh and try again.</Alert.Description></Alert.Content></Alert>;
  if (!preview && !user) return <Spinner aria-label="Loading account" />;
  return <Form aria-label="Account information" action={preview ? undefined : formAction} onSubmit={preview ? event => event.preventDefault() : undefined} className="flex flex-col gap-4" key={user?.id || 'preview'}>
    <SettingsRow label="Account information" description="Your name and sign-in email. A new email address needs to be verified.">
      <TextField fullWidth name="name" isRequired isDisabled={isPending} defaultValue={state.name ?? user?.name ?? ''} maxLength={100}>
        <Label className="sr-only">{t('general.name')}</Label><Input autoComplete={preview ? 'off' : 'name'} placeholder="Your name" /><FieldError />
      </TextField>
      <TextField fullWidth name="email" type="email" isRequired isDisabled={isPending} defaultValue={user?.email ?? ''}>
        <Label className="sr-only">{t('general.email')}</Label><Input autoComplete={preview ? 'off' : 'email'} placeholder="you@example.com" /><FieldError />
      </TextField>
    {(state.error || state.success) && <Alert status={state.error ? 'danger' : 'success'}><Alert.Indicator /><Alert.Content><Alert.Description>{state.error || state.success}</Alert.Description></Alert.Content></Alert>}
    <footer className="flex items-center justify-end gap-2 pt-2"><Button type="submit" variant="primary" isPending={isPending} isDisabled={preview || isPending}>{t('general.saveChanges')}</Button></footer>
    </SettingsRow>
  </Form>;
}
