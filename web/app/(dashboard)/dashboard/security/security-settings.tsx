'use client';

import { Alert, Button, FieldError, Form, Input, Label, Separator, TextField } from '@heroui/react';
import { useActionState } from 'react';
import { updatePassword, deleteAccount } from '@/app/(login)/actions';
import { translate as t } from '@/lib/i18n';
import { SettingsRow } from '@/components/settings-row';

type ActionState = { error?: string; success?: string };

export default function SecuritySettings({ preview = false }: { preview?: boolean }) {
  const [passwordState, passwordAction, isPasswordPending] = useActionState<ActionState, FormData>(updatePassword, {});
  const [deleteState, deleteAction, isDeletePending] = useActionState<ActionState, FormData>(deleteAccount, {});
  return <section id="security" className="flex scroll-mt-6 flex-col gap-4" aria-label="Account security">
    <Form action={preview ? undefined : passwordAction} onSubmit={preview ? event => event.preventDefault() : undefined} className="flex flex-col gap-4">
      <SettingsRow label={t('security.password')} description="Choose a password with at least 8 characters.">
        {(['currentPassword', 'newPassword', 'confirmPassword'] as const).map((name, index) => {
          const label = t((['security.currentPassword', 'security.newPassword', 'security.confirmNewPassword'] as const)[index]);
          return <TextField key={name} fullWidth name={name} type="password" isRequired minLength={8} maxLength={100} isDisabled={isPasswordPending}>
            <Label className="sr-only">{label}</Label><Input placeholder={label} autoComplete={preview ? 'off' : index === 0 ? 'current-password' : 'new-password'} /><FieldError />
          </TextField>;
        })}
        <Feedback state={passwordState} />
        <div className="flex justify-end pt-2"><Button type="submit" variant="secondary" isPending={isPasswordPending} isDisabled={preview || isPasswordPending}>{t('security.updatePassword')}</Button></div>
      </SettingsRow>
    </Form>
    <Separator />
    <Form action={preview ? undefined : deleteAction} onSubmit={preview ? event => event.preventDefault() : undefined}>
      <SettingsRow label={t('security.deleteAccount')} description={t('security.deleteWarning')}>
        <TextField fullWidth name="password" type="password" isRequired minLength={8} maxLength={100} isDisabled={isDeletePending}>
          <Label className="sr-only">{t('security.confirmPassword')}</Label><Input placeholder={t('security.confirmPassword')} autoComplete={preview ? 'off' : 'current-password'} /><FieldError />
        </TextField>
        <Feedback state={deleteState} />
        <div className="flex justify-end pt-2"><Button type="submit" variant="danger-soft" isPending={isDeletePending} isDisabled={preview || isDeletePending}>{t('security.deleteAccount')}</Button></div>
      </SettingsRow>
    </Form>
  </section>;
}
function Feedback({ state }: { state: ActionState }) {
  if (!state.error && !state.success) return null;
  return <Alert status={state.error ? 'danger' : 'success'}><Alert.Indicator /><Alert.Content><Alert.Description>{state.error || state.success}</Alert.Description></Alert.Content></Alert>;
}
