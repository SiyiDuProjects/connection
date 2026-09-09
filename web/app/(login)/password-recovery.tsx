'use client';

import { useActionState, useEffect, useState } from 'react';
import Link from 'next/link';
import { Alert, Button, Card, FieldError, Form, Input, InputGroup, Label, TextField, buttonVariants } from '@heroui/react';
import { ArrowLeft, Eye, EyeOff, KeyRound, Loader2, Mail, X } from 'lucide-react';
import { Brand, ThemeSwitch } from '@/components/reachard/design';
import { BRAND_NAME } from '@/lib/brand';
import type { ActionState } from '@/lib/auth/middleware';
import { confirmPasswordReset, requestPasswordReset } from './public-auth-actions';

export function PasswordRecovery({ token = '' }: { token?: string }) {
  const reset = Boolean(token);
  const validToken = /^[A-Za-z0-9_-]{43}$/.test(token);
  const [showPassword, setShowPassword] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [state, action, pending] = useActionState<ActionState, FormData>(async (previous, data) => {
    try {
      const result = await (reset ? confirmPasswordReset : requestPasswordReset)(previous, data);
      if (result.success && !reset) setCooldown(60);
      return result;
    } catch {
      return { error: 'We could not connect. Please try again.' };
    }
  }, {});
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown(value => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  useEffect(() => {
    if (reset && state.success) window.history.replaceState(window.history.state, '', '/reset-password');
  }, [reset, state.success]);
  const invalidLink = reset && (!validToken || state.invalidLink);

  return <main className="hu-auth">
    <header className="hu-auth-header"><Brand /><ThemeSwitch /></header>
    <div className="hu-auth-center">
      <Card className="hu-auth-card">
        <Link href="/sign-in" className={buttonVariants({ variant: 'tertiary', isIconOnly: true, size: 'sm', className: 'absolute right-5 top-5' })} aria-label="Back to sign in"><X size={20} /></Link>
        <Card.Header className="hu-auth-card-header">
          <div className="hu-auth-icon">{reset ? <KeyRound size={25} strokeWidth={1.7} /> : <Mail size={25} strokeWidth={1.7} />}</div>
          <Card.Title className="text-2xl font-semibold leading-tight tracking-tight">{reset ? 'Choose a new password' : 'Forgot your password?'}</Card.Title>
          <Card.Description>{reset ? `Get back to your ${BRAND_NAME} account.` : 'Enter your account email to receive a reset link.'}</Card.Description>
        </Card.Header>
        <Card.Content>
          {invalidLink ? <div className="hu-auth-fields"><Alert status="danger"><Alert.Indicator /><Alert.Content><Alert.Description>This reset link is invalid or has expired.</Alert.Description></Alert.Content></Alert><Link href="/forgot-password" className={buttonVariants({ variant: 'primary' })}>Request a new link</Link></div> : reset && state.success ? <div className="hu-auth-fields"><Alert status="success"><Alert.Indicator /><Alert.Content><Alert.Description>{state.success}</Alert.Description></Alert.Content></Alert><Link href="/sign-in" className={buttonVariants({ variant: 'primary' })}>Sign in</Link></div> : <Form action={action} className="hu-auth-fields" aria-label={reset ? 'Reset password' : 'Request password reset'}>
            {reset ? <>
              <input type="hidden" name="token" value={token} />
              <TextField isRequired fullWidth name="password" type={showPassword ? 'text' : 'password'} minLength={8} maxLength={100}>
                <Label>New password</Label>
                <InputGroup fullWidth><InputGroup.Input placeholder="At least 8 characters" autoComplete="new-password" /><InputGroup.Suffix><Button isIconOnly size="sm" type="button" variant="ghost" aria-label={showPassword ? 'Hide passwords' : 'Show passwords'} onPress={() => setShowPassword(value => !value)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</Button></InputGroup.Suffix></InputGroup><FieldError />
              </TextField>
              <TextField isRequired fullWidth name="confirmPassword" type={showPassword ? 'text' : 'password'} minLength={8} maxLength={100}>
                <Label>Confirm new password</Label><Input placeholder="Enter it again" autoComplete="new-password" /><FieldError />
              </TextField>
              <p className="text-xs leading-5 text-muted">Your other browser and extension sessions will be signed out.</p>
            </> : <TextField isRequired fullWidth name="email" type="email" maxLength={255}><Label>Email address</Label><Input placeholder="you@example.com" autoComplete="username" autoCapitalize="none" spellCheck={false} /><FieldError /></TextField>}
            {state.error && <Alert status="danger"><Alert.Indicator /><Alert.Content><Alert.Description>{state.error}</Alert.Description></Alert.Content></Alert>}
            {state.success && <Alert status="success"><Alert.Indicator /><Alert.Content><Alert.Description>{state.success}</Alert.Description></Alert.Content></Alert>}
            <Button type="submit" size="lg" fullWidth variant="primary" isDisabled={pending || cooldown > 0}>{pending && <Loader2 className="animate-spin" size={18} />}{pending ? 'One moment…' : cooldown > 0 ? `Send again in ${cooldown}s` : reset ? 'Update password' : state.success ? 'Send another link' : 'Send reset link'}</Button>
            <Link href="/sign-in" className="text-center text-sm text-muted underline">Back to sign in</Link>
          </Form>}
        </Card.Content>
      </Card>
    </div>
    <footer className="hu-auth-bottom"><span>© 2026 {BRAND_NAME}</span><Link href="/"><ArrowLeft size={14} />Back home</Link></footer>
  </main>;
}
