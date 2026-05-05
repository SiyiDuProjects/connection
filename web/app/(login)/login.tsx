'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CircleIcon, Loader2 } from 'lucide-react';
import { signIn, signUp } from './actions';
import { ActionState } from '@/lib/auth/middleware';
import { useI18n } from '@/components/language-provider';

export function Login({ mode = 'signin' }: { mode?: 'signin' | 'signup' }) {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');
  const priceId = searchParams.get('priceId');
  const inviteId = searchParams.get('inviteId');
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    mode === 'signin' ? signIn : signUp,
    { error: '' }
  );
  const switchHref = getSwitchHref({
    mode,
    redirect,
    priceId,
    inviteId
  });

  return (
    <div className="flex min-h-[100dvh] flex-col justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <CircleIcon className="h-12 w-12 text-gray-950" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          {mode === 'signin'
            ? t('login.signInTitle')
            : t('login.signUpTitle')}
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <form className="space-y-6 border border-gray-200 bg-white p-6 shadow-sm" action={formAction}>
          <input type="hidden" name="redirect" value={redirect || ''} />
          <input type="hidden" name="priceId" value={priceId || ''} />
          <input type="hidden" name="inviteId" value={inviteId || ''} />
          <div>
            <Label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              {t('login.email')}
            </Label>
            <div className="mt-1">
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                defaultValue={state.email}
                required
                maxLength={50}
                className="relative block w-full appearance-none rounded-md border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-gray-950 focus:outline-none focus:ring-gray-950 sm:text-sm"
                placeholder={t('login.emailPlaceholder')}
              />
            </div>
          </div>

          <div>
            <Label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              {t('login.password')}
            </Label>
            <div className="mt-1">
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete={
                  mode === 'signin' ? 'current-password' : 'new-password'
                }
                defaultValue={state.password}
                required
                minLength={8}
                maxLength={100}
                className="relative block w-full appearance-none rounded-md border-gray-300 px-3 py-2 text-gray-900 placeholder-gray-500 focus:z-10 focus:border-gray-950 focus:outline-none focus:ring-gray-950 sm:text-sm"
                placeholder={t('login.passwordPlaceholder')}
              />
            </div>
          </div>

          {state?.error && (
            <div className="text-red-500 text-sm">{state.error}</div>
          )}

          <div>
            <Button
              type="submit"
              className="flex w-full items-center justify-center rounded-md border border-transparent bg-gray-950 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-950 focus:ring-offset-2"
              disabled={pending}
            >
              {pending ? (
                <>
                  <Loader2 className="animate-spin mr-2 h-4 w-4" />
                  {t('login.loading')}
                </>
              ) : mode === 'signin' ? (
                t('login.signIn')
              ) : (
                t('login.signUp')
              )}
            </Button>
          </div>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-50 text-gray-500">
                {mode === 'signin'
                  ? t('login.newToPlatform')
                  : t('login.alreadyAccount')}
              </span>
            </div>
          </div>

          <div className="mt-6">
            <Link
              href={switchHref}
              className="flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-950 focus:ring-offset-2"
            >
              {mode === 'signin'
                ? t('login.createAccount')
                : t('login.signInExisting')}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function getSwitchHref({
  mode,
  redirect,
  priceId,
  inviteId
}: {
  mode: 'signin' | 'signup';
  redirect: string | null;
  priceId: string | null;
  inviteId: string | null;
}) {
  const params = new URLSearchParams();
  if (redirect) params.set('redirect', redirect);
  if (priceId) params.set('priceId', priceId);
  if (inviteId) params.set('inviteId', inviteId);

  const path = mode === 'signin' ? '/sign-up' : '/sign-in';
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
