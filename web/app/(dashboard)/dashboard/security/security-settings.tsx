'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Lock, Trash2, Loader2 } from 'lucide-react';
import { useActionState } from 'react';
import { updatePassword, deleteAccount } from '@/app/(login)/actions';
import { translate as t } from '@/lib/i18n';

type PasswordState = {
  error?: string;
  success?: string;
};

type DeleteState = {
  error?: string;
  success?: string;
};

export default function SecuritySettings({ preview = false }: { preview?: boolean }) {
  const [passwordState, passwordAction, isPasswordPending] = useActionState<
    PasswordState,
    FormData
  >(updatePassword, {});

  const [deleteState, deleteAction, isDeletePending] = useActionState<
    DeleteState,
    FormData
  >(deleteAccount, {});

  return (
    <fieldset disabled={preview} id="security" className="scroll-mt-6">
      <div>
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('security.password')}</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" action={passwordAction}>
                <div>
                  <Label htmlFor="current-password" className="mb-2">
                    {t('security.currentPassword')}
                  </Label>
                  <Input
                    id="current-password"
                    name="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    required
                    minLength={8}
                    maxLength={100}
                  />
                </div>
                <div>
                  <Label htmlFor="new-password" className="mb-2">
                    {t('security.newPassword')}
                  </Label>
                  <Input
                    id="new-password"
                    name="newPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={100}
                  />
                </div>
                <div>
                  <Label htmlFor="confirm-password" className="mb-2">
                    {t('security.confirmNewPassword')}
                  </Label>
                  <Input
                    id="confirm-password"
                    name="confirmPassword"
                    type="password"
                    required
                    minLength={8}
                    maxLength={100}
                  />
                </div>
                {passwordState.error && (
                  <p className="text-sm font-medium leading-[1.5] tracking-[-0.01em] text-red-500">{passwordState.error}</p>
                )}
                {passwordState.success && (
                  <p className="text-sm font-medium leading-[1.5] tracking-[-0.01em] text-green-500">{passwordState.success}</p>
                )}
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    className="button-text bg-gray-950 text-white hover:bg-gray-800"
                    disabled={isPasswordPending}
                  >
                    {isPasswordPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('security.updating')}
                      </>
                    ) : (
                      <>
                        <Lock className="mr-2 h-4 w-4" />
                        {t('security.updatePassword')}
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('security.deleteAccount')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="secondary mb-4">
                {t('security.deleteWarning')}
              </p>
              <form action={deleteAction} className="space-y-4">
                <div>
                  <Label htmlFor="delete-password" className="mb-2">
                    {t('security.confirmPassword')}
                  </Label>
                  <Input
                    id="delete-password"
                    name="password"
                    type="password"
                    required
                    minLength={8}
                    maxLength={100}
                  />
                </div>
                {deleteState.error && (
                  <p className="text-sm font-medium leading-[1.5] tracking-[-0.01em] text-red-500">{deleteState.error}</p>
                )}
                <div className="flex justify-end">
                  <Button
                  type="submit"
                  variant="destructive"
                  className="button-text bg-red-600 hover:bg-red-700"
                    disabled={isDeletePending}
                  >
                    {isDeletePending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {t('security.deleting')}
                      </>
                    ) : (
                      <>
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t('security.deleteAccount')}
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </fieldset>
  );
}
