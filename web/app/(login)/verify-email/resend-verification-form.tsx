'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Send } from 'lucide-react';
import { resendVerification } from '../actions';
import { ActionState } from '@/lib/auth/middleware';
import { useI18n } from '@/components/language-provider';

export function ResendVerificationForm({ email }: { email: string }) {
  const { t } = useI18n();
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    resendVerification,
    { email }
  );

  return (
    <form className="space-y-4" action={formAction}>
      <div>
        <Label
          htmlFor="email"
          className="block text-sm font-semibold text-muted-foreground"
        >
          {t('login.email')}
        </Label>
        <div className="mt-1">
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={state.email || email}
            required
            maxLength={255}
            className="relative block w-full appearance-none focus:z-10 sm:text-sm"
            placeholder={t('login.emailPlaceholder')}
          />
        </div>
      </div>

      {state.error && <div className="text-sm font-medium text-destructive">{state.error}</div>}
      {state.success && (
        <div className="text-sm font-medium text-[#248a3d]">{state.success}</div>
      )}

      <Button
        type="submit"
        className="flex w-full items-center justify-center text-sm"
        disabled={pending}
      >
        {pending ? (
          <>
            <Loader2 className="animate-spin mr-2 h-4 w-4" />
            {t('verify.sending')}
          </>
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" />
            {t('verify.resend')}
          </>
        )}
      </Button>
    </form>
  );
}
