'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useActionState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowRightCircle, Loader2, Play } from 'lucide-react';
import { AppHeader } from '@/components/app-header';
import { checkAccountStatus, signIn, signUp } from './actions';
import { ActionState } from '@/lib/auth/middleware';

const fieldClass =
  'h-14 w-full rounded-[12px] border border-transparent bg-transparent px-4 text-[17px] font-normal leading-none text-[#1d1d1f] shadow-[inset_0_0_0_1px_#86868b] placeholder:text-[#6e6e73] transition-shadow duration-150 ease-out focus:outline-none focus:ring-0 focus:shadow-[inset_0_0_0_2px_#0071e3]';

type AuthStep = 'email' | 'signin' | 'verify' | 'signup';

export function Login({ mode = 'signin' }: { mode?: 'signin' | 'signup' }) {
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect');
  const priceId = searchParams.get('priceId');
  const inviteId = searchParams.get('inviteId');
  const ref = searchParams.get('ref');
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<AuthStep>('email');
  const [code, setCode] = useState('');
  const [resendSeconds, setResendSeconds] = useState(60);
  const [statusError, setStatusError] = useState('');
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [codeTransition, setCodeTransition] = useState<'idle' | 'fade' | 'shrink' | 'password'>('idle');
  const codeInputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const lastValidatedCodeRef = useRef('');
  const [signInState, signInAction, isSigningIn] = useActionState<ActionState, FormData>(signIn, { error: '' });
  const [signUpState, signUpAction, isSigningUp] = useActionState<ActionState, FormData>(signUp, { error: '' });

  useEffect(() => {
    if (mode === 'signup') {
      setStep('signup');
    }
  }, [mode]);

  const action = step === 'signup' ? signUpAction : signInAction;
  const pending = isCheckingEmail || isSigningIn || isSigningUp;
  const activeState = step === 'signup' ? signUpState : signInState;
  const title = useMemo(() => {
    if (step === 'signin') return 'Welcome back';
    if (step === 'verify') return 'Verify your email';
    if (step === 'signup') return 'Set your password';
    return 'Continue to Reachard';
  }, [step]);

  useEffect(() => {
    if (step === 'verify') {
      setResendSeconds(60);
      window.setTimeout(() => codeInputRefs.current[0]?.focus(), 180);
    }
  }, [step]);

  useEffect(() => {
    if (step !== 'verify' || resendSeconds <= 0) return;

    const timer = window.setTimeout(() => {
      setResendSeconds((seconds) => Math.max(0, seconds - 1));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [resendSeconds, step]);

  useEffect(() => {
    if (step !== 'verify' || code.length !== 6 || code === lastValidatedCodeRef.current) return;
    lastValidatedCodeRef.current = code;
    validateCode();
  }, [code, step]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (step === 'verify') {
      event.preventDefault();
      validateCode();
      return;
    }

    if (step !== 'email') return;
    event.preventDefault();
    setStatusError('');

    const formData = new FormData(event.currentTarget);
    const nextEmail = String(formData.get('email') || '').trim();

    setIsCheckingEmail(true);
    void (async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 520));
      const result = await checkAccountStatus(nextEmail);
      setIsCheckingEmail(false);

      if ('error' in result && result.error) {
        setStatusError(result.error);
        return;
      }

      setEmail(result.email || nextEmail);
      setCode('');
      lastValidatedCodeRef.current = '';
      setCodeTransition('idle');
      setStep(result.exists ? 'signin' : 'verify');
    })();
  }

  function validateCode() {
    if (code === '123456') {
      setStatusError('');
      setCodeTransition('fade');
      window.setTimeout(() => {
        setCodeTransition('shrink');
      }, 120);
      window.setTimeout(() => {
        setStep('signup');
        setCodeTransition('password');
      }, 240);
      window.setTimeout(() => {
        setCodeTransition('idle');
      }, 300);
      return;
    }

    const message = 'Invalid code. Use 123456 for now.';
    setStatusError(message);
    window.alert(message);
  }

  function updateCode(value: string, index: number) {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    if (!digits) {
      setCode((current) => current.slice(0, index) + current.slice(index + 1));
      return;
    }

    setCode((current) => {
      const next = current.padEnd(6, ' ').split('');
      for (let offset = 0; offset < digits.length && index + offset < 6; offset += 1) {
        next[index + offset] = digits[offset];
      }
      return next.join('').replace(/\s/g, '').slice(0, 6);
    });

    const nextIndex = Math.min(index + digits.length, 5);
    window.setTimeout(() => codeInputRefs.current[nextIndex]?.focus(), 0);
  }

  function focusNextCodeInput() {
    const nextIndex = Math.min(code.length, 5);
    codeInputRefs.current[nextIndex]?.focus();
  }

  return (
    <main className="flex min-h-[100dvh] flex-col bg-white text-[#1d1d1f]">
      <AppHeader className="shrink-0 bg-white" />
      <section className="mx-auto flex w-full max-w-[480px] flex-1 flex-col items-center px-6 pt-4 sm:pt-12">
        <h1 className="text-center text-[28px] font-semibold leading-tight tracking-normal text-[#424245]">
          {title}
        </h1>

        <form className="mt-10 w-full" action={action} onSubmit={handleSubmit}>
          <input type="hidden" name="redirect" value={redirect || ''} />
          <input type="hidden" name="priceId" value={priceId || ''} />
          <input type="hidden" name="inviteId" value={inviteId || ''} />
          <input type="hidden" name="ref" value={ref || ''} />

          <div className="relative">
            <label htmlFor="email" className="sr-only">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                if (step !== 'email') {
                  setStep('email');
                  setCode('');
                  lastValidatedCodeRef.current = '';
                  setCodeTransition('idle');
                }
              }}
              required
              maxLength={255}
              className={`${fieldClass} pr-16`}
              placeholder="Email"
            />
            {step === 'email' ? <SubmitArrowButton pending={pending} label="Continue" /> : null}
          </div>

          <div className={`auth-expand ${step !== 'email' ? 'auth-expand--open' : ''}`}>
            {step !== 'email' ? (
              <div
                className={`auth-step-panel ${
                  step === 'verify' && codeTransition !== 'shrink'
                    ? 'auth-step-panel--verify'
                    : step === 'verify'
                      ? 'auth-step-panel--morph'
                      : 'auth-step-panel--password'
                } pt-4`}
              >
                {step === 'verify' ? (
                <div className="auth-unified-bubble auth-unified-bubble--verify px-5 py-5 text-center">
                  <div
                    className={`transition-[opacity,transform] duration-180 ease-out ${
                      codeTransition === 'idle' ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'
                    }`}
                  >
                    <p className="text-[15px] font-normal leading-6 text-[#6e6e73]">
                      Enter the verification code sent to your email
                    </p>
                    <p className="mt-1 break-all text-[15px] font-normal leading-6 text-[#6e6e73]">
                      {email}
                    </p>

                    <div className="mx-auto mt-6 grid w-fit grid-cols-6 gap-2">
                      {Array.from({ length: 6 }).map((_, index) => (
                        <input
                          key={index}
                          ref={(input) => {
                            codeInputRefs.current[index] = input;
                          }}
                          type="text"
                          inputMode="numeric"
                          autoComplete={index === 0 ? 'one-time-code' : 'off'}
                          value={code[index] || ''}
                          onPointerDown={(event) => {
                            if (index !== Math.min(code.length, 5)) {
                              event.preventDefault();
                              focusNextCodeInput();
                            }
                          }}
                          onFocus={() => {
                            if (index !== Math.min(code.length, 5)) {
                              window.setTimeout(focusNextCodeInput, 0);
                            }
                          }}
                          onChange={(event) => updateCode(event.target.value, index)}
                          onKeyDown={(event) => {
                            if (event.key === 'Backspace' && !code[index] && index > 0) {
                              codeInputRefs.current[index - 1]?.focus();
                            }
                          }}
                          aria-label={`Verification code digit ${index + 1}`}
                          className="h-[45px] w-[50px] min-w-0 rounded-[9px] border border-transparent bg-transparent text-center text-[18px] font-medium leading-none text-[#1d1d1f] shadow-[inset_0_0_0_1px_#d2d2d7] transition-shadow duration-150 ease-out focus:outline-none focus:ring-0 focus:shadow-[inset_0_0_0_2px_#0071e3]"
                        />
                      ))}
                    </div>

                    <button
                      type="button"
                      disabled={resendSeconds > 0}
                      className="mt-3 cursor-pointer text-[14px] font-normal leading-5 text-[#0071e3] transition-colors hover:text-[#005bb5] hover:underline disabled:cursor-default disabled:text-[#0071e3]/55 disabled:hover:no-underline"
                      onClick={() => {
                        setCode('');
                        lastValidatedCodeRef.current = '';
                        setCodeTransition('idle');
                        setStatusError('');
                        setResendSeconds(60);
                        window.setTimeout(() => codeInputRefs.current[0]?.focus(), 0);
                      }}
                    >
                      Didn&apos;t receive a code? Resend{resendSeconds > 0 ? ` (${resendSeconds})` : ''}
                    </button>

                    <button
                      type="submit"
                      className="button-text mx-auto mt-7 inline-flex h-10 w-[340px] cursor-pointer items-center justify-center gap-2 rounded-[9px] bg-[#008ecf] px-4 text-white shadow-[0_7px_14px_rgba(0,113,227,0.14)] transition-[background,transform] duration-200 ease-out hover:bg-[#007fc0] active:scale-[0.99]"
                    >
                      Continue
                      <Play className="h-3 w-3 fill-white/45 stroke-0" aria-hidden="true" />
                    </button>
                  </div>
                </div>
                ) : step === 'signin' || step === 'signup' ? (
                <div
                  className={`auth-unified-bubble auth-unified-bubble--password relative transition-[opacity,transform] duration-220 ease-out ${
                    codeTransition === 'password' ? 'translate-y-1 opacity-0' : 'translate-y-0 opacity-100'
                  }`}
                >
                  <label htmlFor="password" className="sr-only">
                    {step === 'signup' ? 'Set password' : 'Password'}
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete={step === 'signin' ? 'current-password' : 'new-password'}
                    required
                    minLength={8}
                    maxLength={100}
                    className="h-14 w-full bg-transparent px-4 pr-16 text-[17px] font-normal leading-none text-[#1d1d1f] placeholder:text-[#6e6e73] outline-none"
                    placeholder={step === 'signup' ? 'Set password' : 'Password'}
                    autoFocus
                  />
                  <SubmitArrowButton pending={pending} label="Continue" />
                </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {(statusError || activeState?.error) && (
            <p className="mt-5 text-center text-sm font-medium text-destructive">
              {statusError || activeState.error}
            </p>
          )}
        </form>
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
      className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-[#86868b] transition-[color,transform,opacity] duration-200 ease-out hover:text-[#1d1d1f] active:scale-95 disabled:cursor-default disabled:opacity-60"
    >
      {pending ? (
        <Loader2 className="h-5 w-5 animate-spin text-[#86868b]" aria-hidden="true" />
      ) : (
        <ArrowRightCircle className="h-7 w-7 stroke-[1.75]" aria-hidden="true" />
      )}
    </button>
  );
}
