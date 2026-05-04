'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Send } from 'lucide-react';
import { resendVerification } from '../actions';
import { ActionState } from '@/lib/auth/middleware';

export function ResendVerificationForm({ email }: { email: string }) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    resendVerification,
    { email }
  );

  return (
    <form className="space-y-4" action={formAction}>
      <div>
        <Label
          htmlFor="email"
          className="block text-sm font-medium text-gray-700"
        >
          Email
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
            className="appearance-none rounded-full relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-orange-500 focus:border-orange-500 focus:z-10 sm:text-sm"
            placeholder="Enter your email"
          />
        </div>
      </div>

      {state.error && <div className="text-red-500 text-sm">{state.error}</div>}
      {state.success && (
        <div className="text-green-600 text-sm">{state.success}</div>
      )}

      <Button
        type="submit"
        className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-full shadow-sm text-sm font-medium text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
        disabled={pending}
      >
        {pending ? (
          <>
            <Loader2 className="animate-spin mr-2 h-4 w-4" />
            Sending...
          </>
        ) : (
          <>
            <Send className="mr-2 h-4 w-4" />
            Resend verification link
          </>
        )}
      </Button>
    </form>
  );
}
