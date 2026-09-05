'use client';

import { Alert, Button, Card, FieldError, Form, Input, Label, TextField } from '@heroui/react';
import { useActionState } from 'react';
import { updatePassword, deleteAccount } from '@/app/(login)/actions';
import { translate as t } from '@/lib/i18n';

type ActionState = { error?: string; success?: string };

export default function SecuritySettings({ preview = false }: { preview?: boolean }) {
  const [passwordState, passwordAction, isPasswordPending] = useActionState<ActionState, FormData>(updatePassword, {});
  const [deleteState, deleteAction, isDeletePending] = useActionState<ActionState, FormData>(deleteAccount, {});
  return <section id="security" className="scroll-mt-6 space-y-4" aria-label="Account security">
    <Card className="p-6"><Card.Header><Card.Title>{t('security.password')}</Card.Title></Card.Header><Card.Content>
      <Form action={passwordAction} className="flex flex-col gap-5">
        {(['currentPassword', 'newPassword', 'confirmPassword'] as const).map((name, index) => <TextField key={name} fullWidth name={name} type="password" isRequired minLength={8} maxLength={100} isDisabled={preview || isPasswordPending}>
          <Label>{t((['security.currentPassword', 'security.newPassword', 'security.confirmNewPassword'] as const)[index])}</Label><Input autoComplete={index === 0 ? 'current-password' : 'new-password'} /><FieldError />
        </TextField>)}
        <Feedback state={passwordState} />
        <Button type="submit" variant="primary" isPending={isPasswordPending} isDisabled={preview || isPasswordPending}>{t('security.updatePassword')}</Button>
      </Form>
    </Card.Content></Card>
    <Card className="p-6"><Card.Header><Card.Title>{t('security.deleteAccount')}</Card.Title><Card.Description>{t('security.deleteWarning')}</Card.Description></Card.Header><Card.Content>
      <Form action={deleteAction} className="flex flex-col gap-5">
        <TextField fullWidth name="password" type="password" isRequired minLength={8} maxLength={100} isDisabled={preview || isDeletePending}><Label>{t('security.confirmPassword')}</Label><Input autoComplete="current-password" /><FieldError /></TextField>
        <Feedback state={deleteState} />
        <Button type="submit" variant="danger" isPending={isDeletePending} isDisabled={preview || isDeletePending}>{t('security.deleteAccount')}</Button>
      </Form>
    </Card.Content></Card>
  </section>;
}
function Feedback({ state }: { state: ActionState }) {
  if (!state.error && !state.success) return null;
  return <Alert status={state.error ? 'danger' : 'success'}><Alert.Indicator /><Alert.Content><Alert.Description>{state.error || state.success}</Alert.Description></Alert.Content></Alert>;
}
