'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowRightCircle, Loader2 } from 'lucide-react';
import { signIn, signUp } from './actions';
import { ActionState } from '@/lib/auth/middleware';
import { useI18n } from '@/components/language-provider';

const fieldClass =
  'h-14 w-full rounded-[12px] border border-[#86868b] bg-transparent px-4 text-[17px] font-normal leading-none text-[#1d1d1f] placeholder:text-[#6e6e73] transition-[border-color,box-shadow] duration-200 ease-out focus:border-[#0071e3] focus:outline-none focus:ring-4 focus:ring-[#0071e3]/15';

export function Login({ mode = 'signin' }: { mode?: 'signin' | 'signup' }) {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');
  const priceId = searchParams.get('priceId');
  const inviteId = searchParams.get('inviteId');
  const ref = searchParams.get('ref');
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    mode === 'signin' ? signIn : signUp,
    { error: '' }
  );
  const switchHref = getSwitchHref({
    mode,
    redirect,
    priceId,
    inviteId,
    ref
  });

  const submitLabel = mode === 'signin' ? t('login.signIn') : t('login.signUp');

  return (
    <main className="flex min-h-[100dvh] flex-col bg-background px-6 py-16 text-[#1d1d1f]">
      <section className="mx-auto flex w-full max-w-[480px] flex-1 flex-col items-center pt-4 sm:pt-12">
        <h1 className="text-center text-[28px] font-semibold leading-tight tracking-normal text-[#424245]">
          {mode === 'signin'
            ? t('login.signInTitle')
            : t('login.signUpTitle')}
        </h1>

        <form className="mt-10 w-full space-y-4" action={formAction}>
          <input type="hidden" name="redirect" value={redirect || ''} />
          <input type="hidden" name="priceId" value={priceId || ''} />
          <input type="hidden" name="inviteId" value={inviteId || ''} />
          {mode === 'signin' ? (
            <input type="hidden" name="ref" value={ref || ''} />
          ) : null}

          <div>
            <label htmlFor="email" className="sr-only">
              {t('login.email')}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={state.email}
              required
              maxLength={50}
              className={fieldClass}
              placeholder={t('login.emailPlaceholder')}
            />
          </div>

          <div className="relative">
            <label htmlFor="password" className="sr-only">
              {t('login.password')}
            </label>
            <input
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
              className={`${fieldClass} ${mode === 'signin' ? 'pr-14' : ''}`}
              placeholder={t('login.passwordPlaceholder')}
            />
            {mode === 'signin' ? (
              <SubmitArrowButton pending={pending} label={submitLabel} />
            ) : null}
          </div>

          {mode === 'signup' ? (
            <div className="relative">
              <label htmlFor="ref" className="sr-only">
                {t('login.inviteCode')}
              </label>
              <input
                id="ref"
                name="ref"
                type="text"
                autoComplete="off"
                defaultValue={state.ref ?? ref ?? ''}
                maxLength={120}
                className={`${fieldClass} pr-14`}
                placeholder={t('login.inviteCodePlaceholder')}
              />
              <SubmitArrowButton pending={pending} label={submitLabel} />
            </div>
          ) : null}

          {state?.error && (
            <p className="pt-1 text-center text-sm font-medium text-destructive">{state.error}</p>
          )}
        </form>

        <div className="mt-28 text-center text-sm leading-6 text-[#424245]">
          <p>
            {mode === 'signin'
              ? t('login.newToPlatform')
              : t('login.alreadyAccount')}{' '}
            <Link
              href={switchHref}
              className="font-normal text-[#0066cc] transition-colors hover:text-[#004f9f] hover:underline"
            >
              {mode === 'signin'
                ? t('login.createAccount')
                : t('login.signInExisting')}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}

function SubmitArrowButton({ pending, label }: { pending: boolean; label: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      aria-label={label}
      title={label}
      className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[#86868b] transition-[color,transform] duration-200 ease-out hover:text-[#1d1d1f] active:scale-95 disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
      ) : (
        <ArrowRightCircle className="h-7 w-7 stroke-[1.75]" aria-hidden="true" />
      )}
    </button>
  );
}

function getSwitchHref({
  mode,
  redirect,
  priceId,
  inviteId,
  ref
}: {
  mode: 'signin' | 'signup';
  redirect: string | null;
  priceId: string | null;
  inviteId: string | null;
  ref: string | null;
}) {
  const params = new URLSearchParams();
  if (redirect) params.set('redirect', redirect);
  if (priceId) params.set('priceId', priceId);
  if (inviteId) params.set('inviteId', inviteId);
  if (ref) params.set('ref', ref);

  const path = mode === 'signin' ? '/sign-up' : '/sign-in';
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}
