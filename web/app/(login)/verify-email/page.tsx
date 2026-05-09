import Link from 'next/link';
import { MailCheck } from 'lucide-react';
import { ResendVerificationForm } from './resend-verification-form';
import { cookies, headers } from 'next/headers';
import { normalizeLanguage, translate } from '@/lib/i18n';

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; error?: string }>;
}) {
  const { email = '', error } = await searchParams;
  const language = normalizeLanguage((await cookies()).get('language')?.value || (await headers()).get('accept-language'));
  const t = (key: Parameters<typeof translate>[1], values?: Record<string, string | number>) =>
    translate(language, key, values);

  return (
    <div className="flex min-h-[100dvh] flex-col justify-center bg-background px-4 py-12 text-foreground sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-primary text-primary-foreground">
            <MailCheck className="h-6 w-6" />
          </span>
        </div>
        <h2 className="mt-6 text-center text-3xl font-semibold text-foreground">
          {t('verify.title')}
        </h2>
        <p className="mt-3 text-center text-sm font-medium leading-6 text-muted-foreground">
          {t('verify.sentTo', { email: email || t('verify.yourEmail') })}
        </p>
        {error && (
          <p className="mt-3 text-center text-sm font-medium text-destructive">
            {t('verify.invalid')}
          </p>
        )}
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="apple-card p-6">
          <ResendVerificationForm email={email} />
        </div>
        <div className="mt-6 text-center text-sm">
          <Link
            href="/sign-in"
            className="font-semibold text-primary underline-offset-4 hover:underline"
          >
            {t('verify.back')}
          </Link>
        </div>
      </div>
    </div>
  );
}
