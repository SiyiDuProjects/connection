'use client';
import { BRAND_NAME } from '@/lib/brand';

import { Alert, Button, Card, FieldError, Form, Input, InputGroup, Label, TextField, buttonVariants } from '@heroui/react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Loader2, Mail, X } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useActionState, useState } from 'react';
import { authenticate } from './public-auth-actions';
import type { ActionState } from '@/lib/auth/middleware';
import { Brand, ThemeSwitch } from '@/components/reachard/design';

// Both existing auth URLs render the same form; keep their callers compatible.
export function Login(_props: { mode?: 'signin' | 'signup' } = {}) {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [state, action, pending] = useActionState<ActionState, FormData>(async (previous, data) => {
    try { return await authenticate(previous, data); }
    catch (error) {
      if (error && typeof error === 'object' && 'digest' in error && String(error.digest).startsWith('NEXT_REDIRECT')) throw error;
      return { error: 'We could not connect to your account. Please try again when the account service is available.' };
    }
  }, { error: '' });

  return <main className="hu-auth">
    <header className="hu-auth-header"><Brand /><ThemeSwitch /></header>
    <div className="hu-auth-center">
      <Card className="hu-auth-card">
        <Link href="/" className={buttonVariants({ variant: 'tertiary', isIconOnly: true, size: 'sm', className: 'absolute right-5 top-5' })} aria-label="Close and return home"><X size={20}/></Link>
        <Card.Header className="hu-auth-card-header">
          <div className="hu-auth-icon"><Mail size={25} strokeWidth={1.7}/></div>
          <Card.Title className="text-2xl font-semibold leading-tight tracking-tight">Continue to {BRAND_NAME}</Card.Title>
          <Card.Description>Log in or create an account with your email.</Card.Description>
        </Card.Header>
        <Card.Content>
          <Form action={action} className="hu-auth-fields" aria-label={`Continue to ${BRAND_NAME}`}>
            {['redirect', 'priceId', 'inviteId', 'ref'].map(key => <input key={key} type="hidden" name={key} value={searchParams.get(key) || ''}/>)}
            <TextField isRequired fullWidth name="email" type="email" value={email} onChange={setEmail} maxLength={255}>
              <Label>Email address</Label><Input placeholder="you@example.com" autoComplete="username" autoCapitalize="none" spellCheck={false}/><FieldError/>
            </TextField>
            <TextField isRequired fullWidth name="password" type={showPassword ? 'text' : 'password'} minLength={8} maxLength={100}>
              <Label>Password</Label>
              <InputGroup fullWidth>
                <InputGroup.Input placeholder="At least 8 characters" autoComplete="current-password"/>
                <InputGroup.Suffix><Button isIconOnly size="sm" type="button" variant="ghost" aria-label={showPassword ? 'Hide password' : 'Show password'} onPress={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={17}/> : <Eye size={17}/>}</Button></InputGroup.Suffix>
              </InputGroup><FieldError/>
            </TextField>
            <Link href="/forgot-password" className="-mt-2 text-right text-sm text-muted underline">Forgot password?</Link>
            {state?.error && <Alert status="danger"><Alert.Indicator/><Alert.Content><Alert.Description>{state.error}</Alert.Description></Alert.Content></Alert>}
            <Button type="submit" size="lg" fullWidth variant="primary" isDisabled={pending}>{pending ? <Loader2 className="animate-spin" size={18}/> : null}{pending ? 'One moment…' : 'Continue'}{!pending && <ArrowRight size={18}/>}</Button>
            <p className="text-center text-xs text-muted">New here? Verify your email to try 3 free email unlocks. No card required.</p>
          </Form>
        </Card.Content>
      </Card>
      <p className="hu-auth-legal">By continuing, you agree to our<br/><Link href="/terms">Terms of Service</Link> and <Link href="/privacy">Privacy Policy</Link>.</p>
    </div>
    <footer className="hu-auth-bottom"><span>© 2026 {BRAND_NAME}</span><Link href="/"><ArrowLeft size={14}/>Back home</Link></footer>
  </main>;
}
