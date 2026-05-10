'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Lock, Trash2, Loader2, LogOut } from 'lucide-react';
import { useActionState } from 'react';
import { updatePassword, deleteAccount, signOut } from '@/app/(login)/actions';
import { useI18n } from '@/components/language-provider';
import { useRouter } from 'next/navigation';
import { mutate } from 'swr';
import { clearExtensionSessionBeforeSignOut } from '@/components/extension-session-bridge';

type PasswordState = {
  currentPassword?: string;
  newPassword?: string;
  confirmPassword?: string;
  error?: string;
  success?: string;
};

type DeleteState = {
  password?: string;
  error?: string;
  success?: string;
};

export default function SecurityPage() {
  const { t, language, languageMode, setLanguage, useBrowserLanguage } = useI18n();
  const router = useRouter();
  const [passwordState, passwordAction, isPasswordPending] = useActionState<
    PasswordState,
    FormData
  >(updatePassword, {});

  const [deleteState, deleteAction, isDeletePending] = useActionState<
    DeleteState,
    FormData
  >(deleteAccount, {});

  async function handleSignOut() {
    await clearExtensionSessionBeforeSignOut();
    await signOut();
    mutate('/api/user');
    router.push('/');
  }

  return (
    <section className="min-h-[calc(100dvh-64px)] px-6 py-6 lg:py-8">
      <div className="mx-auto max-w-[760px]">
        <h1 className="page-title mb-5">
          {t('security.title')}
        </h1>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('general.language')}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="secondary mb-3">
                {t('general.languageDescription')}
              </p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={useBrowserLanguage}
                  className={`button-text h-9 rounded-[8px] px-3 transition-colors hover:bg-[#f9f9f9] ${
                    languageMode === 'browser' ? 'bg-[#f3f3f3] text-gray-950' : 'text-gray-500'
                  }`}
                >
                  {t('general.languageBrowser')}
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className={`button-text h-9 rounded-[8px] px-3 transition-colors hover:bg-[#f9f9f9] ${
                    languageMode === 'manual' && language === 'en' ? 'bg-[#f3f3f3] text-gray-950' : 'text-gray-500'
                  }`}
                >
                  {t('general.languageEnglish')}
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('zh')}
                  className={`button-text h-9 rounded-[8px] px-3 transition-colors hover:bg-[#f9f9f9] ${
                    languageMode === 'manual' && language === 'zh' ? 'bg-[#f3f3f3] text-gray-950' : 'text-gray-500'
                  }`}
                >
                  {t('general.languageChinese')}
                </button>
              </div>
            </CardContent>
          </Card>

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
                    defaultValue={passwordState.currentPassword}
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
                    defaultValue={passwordState.newPassword}
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
                    defaultValue={passwordState.confirmPassword}
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
              <CardTitle>Log out</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="secondary mb-4">
                End this session and return to the homepage.
              </p>
              <Button
                type="button"
                onClick={handleSignOut}
                variant="outline"
                className="button-text bg-white text-gray-950 hover:bg-gray-50"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </Button>
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
                    defaultValue={deleteState.password}
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
    </section>
  );
}
