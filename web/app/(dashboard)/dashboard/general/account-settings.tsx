'use client';

import { useActionState } from 'react';
import { Alert, Button, Card, FieldError, Form, Input, Label, Spinner, TextField } from '@heroui/react';
import { updateAccount } from '@/app/(login)/actions';
import type { PublicUser } from '@/lib/auth/public-user';
import useSWR from 'swr';
import { translate as t } from '@/lib/i18n';

type ActionState = { name?: string; error?: string; success?: string };
const fetcher = async (url: string) => { const response = await fetch(url); if (!response.ok) throw new Error('Could not load your account.'); return response.json(); };

export default function AccountSettings({ preview = false }: { preview?: boolean }) {
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(updateAccount, {});
  const { data: user, error } = useSWR<PublicUser>(preview ? null : '/api/user', fetcher);
  return <Card className="p-6" aria-label="Account information">
    <Card.Header><Card.Title>{t('general.accountInfo')}</Card.Title></Card.Header>
    <Card.Content>
      {error ? <Alert status="danger"><Alert.Content><Alert.Description>Could not load your account. Please refresh and try again.</Alert.Description></Alert.Content></Alert> : !preview && !user ? <Spinner aria-label="Loading account" /> :
      <Form action={formAction} className="flex flex-col gap-5" key={user?.id || 'preview'}>
        <TextField fullWidth name="name" isRequired isDisabled={preview || isPending} defaultValue={state.name ?? user?.name ?? ''} maxLength={100}><Label>{t('general.name')}</Label><Input autoComplete="name" /><FieldError /></TextField>
        <TextField fullWidth name="email" type="email" isRequired isDisabled={preview || isPending} defaultValue={user?.email ?? ''}><Label>{t('general.email')}</Label><Input autoComplete="email" /><FieldError /></TextField>
        {(state.error || state.success) && <Alert status={state.error ? 'danger' : 'success'}><Alert.Indicator /><Alert.Content><Alert.Description>{state.error || state.success}</Alert.Description></Alert.Content></Alert>}
        <Button type="submit" variant="primary" isPending={isPending} isDisabled={preview || isPending}>{t('general.saveChanges')}</Button>
      </Form>}
    </Card.Content>
  </Card>;
}
