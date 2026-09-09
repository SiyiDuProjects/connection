'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button, buttonVariants } from '@heroui/react';
import { Stepper } from '@heroui-pro/react';
import { ArrowLeft, ArrowRight, Check, Pin, Puzzle } from 'lucide-react';
import { BRAND_MARK_PATH, BRAND_NAME } from '@/lib/brand';
import { CHROME_STORE_URL as storeUrl } from '@/lib/extension-store';
import { useExtensionStatus } from '@/components/use-extension-status';
import { useCurrentUser } from '@/lib/auth/use-current-user';
import { ExtensionDemo } from '@/components/reachard/extension-demo';
import '../home.css';
import './welcome.css';

const steps = ['Welcome', 'Pin extension', 'Your account', 'First search'];
const returnTo = encodeURIComponent('/getting-started?step=4');

export function GettingStarted() {
  const [step, setStep] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const { status, check } = useExtensionStatus();
  const { data: user, isLoading, error } = useCurrentUser();
  useEffect(() => {
    const value = Number(new URLSearchParams(window.location.search).get('step'));
    if (Number.isInteger(value) && value >= 1 && value <= 4) setStep(value - 1);
    else if (window.location.hash === '#install') setStep(1);
  }, []);
  function goTo(next: number) {
    setStep(next);
    const url = new URL(window.location.href);
    url.searchParams.set('step', String(next + 1));
    window.history.replaceState(null, '', url);
    requestAnimationFrame(() => heading.current?.focus({ preventScroll: true }));
  }
  const titles = [`Welcome to ${BRAND_NAME}.`, 'Keep your next connection one click away.', user ? 'Your account is ready.' : 'A home for your connections.', 'Start with a job you want.'];

  return <main className="rw-welcome">
    <header className="rw-header">
      <Link href="/" aria-label={`${BRAND_NAME} home`} className="rw-brand"><img src={BRAND_MARK_PATH} width="32" height="32" alt="" />{BRAND_NAME}</Link>
      <a href="mailto:support@reachard.co" className="rw-help">Need help?</a>
    </header>
    <div className="rw-layout">
      <section className="rw-copy" aria-labelledby="welcome-title">
        <Stepper currentStep={step} size="sm" aria-label="Extension setup progress" className="rw-progress">
          {steps.map(title => <Stepper.Step key={title}><Stepper.Indicator /><Stepper.Content className="sr-only"><Stepper.Title>{title}</Stepper.Title></Stepper.Content><Stepper.Separator /></Stepper.Step>)}
        </Stepper>
        <p className="rw-eyebrow">{steps[step]} · {step + 1} of 4</p>
        <h1 id="welcome-title" ref={heading} tabIndex={-1}>{titles[step]}</h1>
        <div className="rw-body">
          {step === 0 && <><p>Find the people behind the job you want. Get a work email, write a thoughtful introduction, and make your next move.</p><p>A quick tour, then you’re ready to go.</p></>}
          {step === 1 && <>
            <ol className="rw-instructions"><li><Puzzle size={20} aria-hidden="true" /><span>Open Chrome’s <strong>Extensions</strong> menu beside the address bar.</span></li><li><Pin size={20} aria-hidden="true" /><span>Click the pin next to <strong>{BRAND_NAME}</strong>.</span></li><li><img src={BRAND_MARK_PATH} width="20" height="20" alt="" /><span>On a job page, click the {BRAND_NAME} icon to open the sidebar.</span></li></ol>
            <div className="rw-install" id="install"><p role="status">{status === 'detected' ? 'Extension detected in this browser.' : status === 'checking' ? 'Checking this browser…' : 'Not detected here yet. Use Chrome on your computer, and refresh after installing.'}</p>{status !== 'detected' && <div className="rw-inline-actions"><a href={storeUrl} target="_blank" rel="noopener noreferrer">Add to Chrome</a><Button variant="ghost" size="sm" isPending={status === 'checking'} onPress={() => void check()}>Check again</Button></div>}</div>
          </>}
          {step === 2 && <>
            <p>{user ? 'Stay signed in on this browser. Your extension connects to your Reachard account automatically.' : 'Your account keeps your profile, saved contacts, drafts, and email credits together. Signing in here connects the extension automatically.'}</p>
            <p>You can finish this tour first. Sign in when you’re ready to search.</p>
            {error && <p role="status" className="text-sm">We couldn’t check your session. You can continue the tour or open sign in.</p>}
          </>}
          {step === 3 && <>
            <p>Open a specific job posting on LinkedIn or a company’s careers site, then click the {BRAND_NAME} toolbar icon.</p>
            <ol className="rw-first-search"><li>Check the company and role, then find people.</li><li>Choose a person and reveal their work email.</li><li>Draft an introduction, review it, and send it from your email app.</li></ol>
            <p className="rw-note">Searches and drafts use no email credits. A credit is used only when a verified work email is found. You control sending.</p>
          </>}
        </div>
        <div className="rw-actions">
          {step > 0 && <Button variant="tertiary" isIconOnly aria-label="Previous step" onPress={() => goTo(step - 1)}><ArrowLeft size={18} /></Button>}
          {step < 2 && <Button size="lg" onPress={() => goTo(step + 1)}>Next<ArrowRight size={18} /></Button>}
          {step === 2 && (user ? <Button size="lg" onPress={() => goTo(3)}>Continue<ArrowRight size={18} /></Button> : <Link href={`/sign-up?redirect=${returnTo}`} className={buttonVariants({ variant: 'primary', size: 'lg' })}>Create account<ArrowRight size={18} /></Link>)}
          {step === 3 && <Link href={user ? '/dashboard' : `/sign-up?redirect=${returnTo}`} className={buttonVariants({ variant: 'primary', size: 'lg' })}>{user ? <><Check size={18} />Go to Dashboard</> : <>Create account<ArrowRight size={18} /></>}</Link>}
          {step < 2 && <Button variant="ghost" onPress={() => goTo(3)}>Skip tour</Button>}
          {step === 2 && <Button variant="ghost" onPress={() => goTo(3)}>Finish tour first</Button>}
          {step === 3 && <Button variant="ghost" onPress={() => goTo(0)}>Replay tour</Button>}
        </div>
        {step >= 2 && !user && <p className="rw-signin">{isLoading ? 'Checking your account…' : <>Already have an account? <Link href={`/sign-in?redirect=${returnTo}`}>Sign in</Link></>}</p>}
      </section>
      <aside className="rw-visual" aria-label="See how Reachard works">
        {step === 1 ? <figure className="rw-pin-figure"><img src="/images/welcome/pin-extension.png" width="1448" height="1086" alt="Illustration: open Chrome's puzzle-piece Extensions menu, then click the pin beside Reachard." /><figcaption>Pin once. Open Reachard from any job page.</figcaption></figure>
          : step === 2 ? <figure className="rw-account-figure"><div className="rw-account-crop"><img src="/images/welcome/account.png" width="1265" height="711" alt="Preview of the Reachard email sign-in and account creation form." /></div><figcaption>Sign in on the website. Your extension connects automatically.</figcaption></figure>
          : <ExtensionDemo />}
      </aside>
    </div>
    <footer className="rw-footer">Your next conversation starts with one person.</footer>
  </main>;
}
