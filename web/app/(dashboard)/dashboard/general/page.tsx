'use client';

import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { updateAccount } from '@/app/(login)/actions';
import { User } from '@/lib/db/schema';
import useSWR from 'swr';
import { Suspense } from 'react';
import { useI18n } from '@/components/language-provider';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type ActionState = {
  name?: string;
  error?: string;
  success?: string;
};

type AccountFormProps = {
  state: ActionState;
  nameValue?: string;
  emailValue?: string;
};

function AccountForm({
  state,
  nameValue = '',
  emailValue = ''
}: AccountFormProps) {
  const { t } = useI18n();
  return (
    <>
      <div>
        <Label htmlFor="name" className="mb-2">
          {t('general.name')}
        </Label>
        <Input
          id="name"
          name="name"
          placeholder={t('general.namePlaceholder')}
          defaultValue={state.name || nameValue}
          required
        />
      </div>
      <div>
        <Label htmlFor="email" className="mb-2">
          {t('general.email')}
        </Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder={t('general.emailPlaceholder')}
          defaultValue={emailValue}
          required
        />
      </div>
    </>
  );
}

function AccountFormWithData({ state }: { state: ActionState }) {
  const { data: user } = useSWR<User>('/api/user', fetcher);
  return (
    <AccountForm
      state={state}
      nameValue={user?.name ?? ''}
      emailValue={user?.email ?? ''}
    />
  );
}

export default function GeneralPage() {
  const { t } = useI18n();
  const [state, formAction, isPending] = useActionState<ActionState, FormData>(
    updateAccount,
    {}
  );

  return (
    <section className="flex-1 p-4 lg:p-8">
      <h1 className="page-title mb-6">
        {t('general.title')}
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>{t('general.accountInfo')}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" action={formAction}>
            <Suspense fallback={<AccountForm state={state} />}>
              <AccountFormWithData state={state} />
            </Suspense>
            {state.error && (
              <p className="text-sm font-medium leading-[1.5] tracking-[-0.01em] text-red-500">{state.error}</p>
            )}
            {state.success && (
              <p className="text-sm font-medium leading-[1.5] tracking-[-0.01em] text-green-500">{state.success}</p>
            )}
            <Button
              type="submit"
              className="button-text bg-gray-950 text-white hover:bg-gray-800"
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('general.saving')}
                </>
              ) : (
                t('general.saveChanges')
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
