'use client';

// Official HeroUI v3 InputOTP Form Example and compound Card anatomy.
// https://heroui.com/docs/react/components/input-otp
import { Button, Card, Description, FieldError, Form, Input, InputOTP, Label, REGEXP_ONLY_DIGITS, Spinner, TextField } from '@heroui/react';
import { ArrowLeft, MailCheck } from 'lucide-react';
import Link from 'next/link';
import { useActionState, useEffect, useState } from 'react';
import { confirmVerification, resendVerification } from '../public-auth-actions';
import type { ActionState } from '@/lib/auth/middleware';
import { Brand, ThemeSwitch } from '@/components/reachard/design';

export function ResendVerificationForm({ email: initialEmail, error, redirectTo = '', priceId = '', initialCooldown = 0 }: {
  email: string; error?: string; redirectTo?: string; priceId?: string; initialCooldown?: number;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(initialCooldown);
  const [verifyState, verifyAction, verifying] = useActionState<ActionState, FormData>(confirmVerification, {});
  const [resendState, resendAction, sending] = useActionState<ActionState, FormData>(async (previous, data) => {
    const result = await resendVerification(previous, data);
    setCooldown(Number(result.retryAfter) || 0);
    if (result.success) setCode('');
    return result;
  }, {});
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown(value => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  const busy = verifying || sending;
  const initialError = error === 'delivery' ? 'Your email still needs verification, but we could not send the code. Request a new one below.'
    : error ? 'That verification link is invalid or expired. Request a new code below.' : '';

  return <main className="hu-auth">
    <header className="hu-auth-header"><Brand/><ThemeSwitch/></header>
    <div className="hu-auth-center">
      <Card className="hu-auth-card">
        <Card.Header className="hu-auth-card-header">
          <div className="hu-auth-icon"><MailCheck size={27} strokeWidth={1.7}/></div>
          <Card.Title>Verify your email</Card.Title>
          <Card.Description>Enter the six-digit code from your email.</Card.Description>
        </Card.Header>
        <Card.Content className="flex flex-col gap-5">
          <Form action={verifyAction} className="hu-auth-fields">
            <input type="hidden" name="redirect" value={redirectTo}/>
            <input type="hidden" name="priceId" value={priceId}/>
            <TextField isRequired fullWidth name="email" type="email" maxLength={255} value={email} onChange={value => { setEmail(value); setCode(''); }} isDisabled={busy}>
              <Label>Email address</Label><Input autoComplete="email" placeholder="you@example.com"/><FieldError/>
            </TextField>
            <div className="flex flex-col items-center gap-3">
              <Label htmlFor="verification-code">Verification code</Label>
              <InputOTP className="justify-center" id="verification-code" aria-label="Six-digit verification code" aria-describedby={verifyState.error ? 'code-help code-error' : 'code-help'}
                name="code" maxLength={6} pattern={REGEXP_ONLY_DIGITS} inputMode="numeric" autoComplete="one-time-code"
                value={code} onChange={setCode} isInvalid={Boolean(verifyState.error)} isDisabled={busy} variant="secondary">
                <InputOTP.Group><InputOTP.Slot index={0}/><InputOTP.Slot index={1}/><InputOTP.Slot index={2}/></InputOTP.Group>
                <InputOTP.Separator/>
                <InputOTP.Group><InputOTP.Slot index={3}/><InputOTP.Slot index={4}/><InputOTP.Slot index={5}/></InputOTP.Group>
              </InputOTP>
              <Description id="code-help">Valid for 10 minutes. Check spam, too.</Description>
            </div>
            {verifyState.error && <p id="code-error" role="alert" className="text-sm text-danger">{verifyState.error}</p>}
            <Button type="submit" variant="primary" size="lg" fullWidth isDisabled={busy || code.length !== 6 || !email} isPending={verifying}>
              {verifying && <Spinner size="sm" color="current"/>}{verifying ? 'Verifying…' : 'Verify email'}
            </Button>
          </Form>
          <Form action={resendAction} className="flex flex-col items-center gap-3">
            <input type="hidden" name="email" value={email}/>
            {(resendState.error || (!resendState.success && initialError)) && <p role="alert" className="text-sm text-danger">{resendState.error || initialError}</p>}
            {resendState.success && <p role="status" className="text-sm text-muted">{resendState.success}</p>}
            <Button type="submit" variant="ghost" isDisabled={busy || cooldown > 0 || !email} isPending={sending}>
              {sending ? 'Sending…' : cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
            </Button>
          </Form>
        </Card.Content>
        <Card.Footer className="hu-auth-card-footer"><p><Link href="/sign-in">Back to log in</Link></p></Card.Footer>
      </Card>
    </div>
    <footer className="hu-auth-bottom"><span>© 2026 Reachard</span><Link href="/"><ArrowLeft size={14}/>Back home</Link></footer>
  </main>;
}
