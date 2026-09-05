'use client';
import { Button, Card, FieldError, Form, Input, InputGroup, Label, TextField, buttonVariants } from '@heroui/react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Eye, EyeOff, Loader2, Mail, UserRound, X } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useActionState, useState, type FormEvent } from 'react';
import { checkAccountStatus, signIn, signUp } from './public-auth-actions';
import type { ActionState } from '@/lib/auth/middleware';
import { Brand, ThemeSwitch } from '@/components/reachard/design';

export function Login({ mode = 'signin' }: { mode?: 'signin' | 'signup' }) {
  const searchParams = useSearchParams();
  const [signup, setSignup] = useState(mode === 'signup');
  const [emailStep, setEmailStep] = useState(mode === 'signin');
  const [email, setEmail] = useState('');
  const [checking, setChecking] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [started, setStarted] = useState(!signup);
  const [showPassword, setShowPassword] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(async (previous, data) => {
    try { return await (signup ? signUp : signIn)(previous, data); }
    catch (error) {
      if (error && typeof error === 'object' && 'digest' in error && String(error.digest).startsWith('NEXT_REDIRECT')) throw error;
      return { error: 'We could not connect to your account. Please try again when the account service is available.' };
    }
  }, { error: '' });
  async function checkEmail(event: FormEvent<HTMLFormElement>) {
    if (!emailStep) return;
    event.preventDefault();
    setChecking(true);
    setEmailError('');
    try {
      const result = await checkAccountStatus(email);
      if (!('email' in result)) { setEmailError(result.error); return; }
      setEmail(result.email || email);
      setSignup(!result.exists);
      setEmailStep(false);
    } catch {
      setEmailError('We could not check your account. Please try again.');
    } finally { setChecking(false); }
  }
  const busy = pending || checking;
  const preserved = new URLSearchParams();
  for (const key of ['redirect', 'priceId', 'inviteId', 'ref']) { const value = searchParams.get(key); if (value) preserved.set(key, value); }
  const switchUrl = `${signup ? '/sign-in' : '/sign-up'}${preserved.size ? `?${preserved}` : ''}`;

  return <main className="hu-auth">
    <header className="hu-auth-header"><Brand /><ThemeSwitch /></header>
    <div className="hu-auth-center">
      <Card className="hu-auth-card">
        <Link href="/" className={buttonVariants({ variant: 'tertiary', isIconOnly: true, size: 'sm', className: 'absolute right-5 top-5' })} aria-label="Close and return home"><X size={20}/></Link>
        <Card.Header className="hu-auth-card-header">
          <div className="hu-auth-icon">{started ? <Mail size={25} strokeWidth={1.7}/> : <UserRound size={27} strokeWidth={1.7}/>}</div>
          <Card.Title>{signup ? started ? 'Create your account' : 'Create an account' : emailStep ? 'Continue to Reachard' : 'Welcome back'}</Card.Title>
          <Card.Description>{started ? signup ? 'Your next conversation starts here.' : 'Log in to your Reachard workspace.' : <>Find the people behind<br/>your next opportunity.</>}</Card.Description>
        </Card.Header>
        <Card.Content>
          {started ? <Form action={action} onSubmit={checkEmail} className="hu-auth-fields">
            {['redirect', 'priceId', 'inviteId', 'ref'].map(key => <input key={key} type="hidden" name={key} value={searchParams.get(key) || ''}/>)}
            <TextField isRequired fullWidth name="email" type="email" value={email} onChange={value => { setEmail(value); if (mode === 'signin') setEmailStep(true); }} maxLength={255}><Label>Email address</Label><Input placeholder="you@example.com" autoComplete="email" autoFocus/><FieldError/></TextField>
            {!emailStep && <TextField isRequired fullWidth name="password" type={showPassword ? 'text' : 'password'} minLength={8} maxLength={100}><Label>{signup ? 'Create a password' : 'Password'}</Label><InputGroup fullWidth><InputGroup.Input placeholder={signup ? 'At least 8 characters' : 'Your password'} autoComplete={signup ? 'new-password' : 'current-password'}/><InputGroup.Suffix><Button isIconOnly size="sm" type="button" variant="ghost" aria-label={showPassword ? 'Hide password' : 'Show password'} onPress={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</Button></InputGroup.Suffix></InputGroup><FieldError/></TextField>}
            {(emailError || state?.error) && <p role="alert" className="rd-form-error">{emailError || state.error}</p>}
            <Button type="submit" size="lg" fullWidth variant="primary" isDisabled={busy}>{busy ? <Loader2 className="animate-spin" size={18}/> : null}{busy ? 'One moment…' : emailStep ? 'Continue' : signup ? 'Create account' : 'Log in'}{!busy && <ArrowRight size={18}/>}</Button>
          </Form> : <Button fullWidth size="lg" variant="primary" onPress={() => setStarted(true)}>Get started<ArrowRight size={18}/></Button>}
          {!started && <p className="hu-auth-email-note">Continue with your email address</p>}
        </Card.Content>
        <Card.Footer className="hu-auth-card-footer">
          <p>{signup ? 'Already have an account?' : 'New to Reachard?'} <Link href={switchUrl}>{signup ? 'Log in' : 'Create an account'}</Link></p>
        </Card.Footer>
      </Card>
      <p className="hu-auth-legal">{signup ? 'By creating an account, you agree to our' : 'Your account. Your connections.'}<br/><Link href="/terms">Terms of Service</Link> and <Link href="/privacy">Privacy Policy</Link>.</p>
    </div>
    <footer className="hu-auth-bottom"><span>© 2026 Reachard</span><Link href="/"><ArrowLeft size={14}/>Back home</Link></footer>
  </main>;
}
