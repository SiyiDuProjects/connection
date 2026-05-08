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
    <div className="flex min-h-[100dvh] flex-col justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <MailCheck className="h-12 w-12 text-gray-950" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          {t('verify.title')}
        </h2>
        <p className="mt-3 text-center text-sm text-gray-600">
          {t('verify.sentTo', { email: email || t('verify.yourEmail') })}
        </p>
        {error && (
          <p className="mt-3 text-center text-sm text-red-500">
            {t('verify.invalid')}
          </p>
        )}
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="border border-gray-200 bg-white p-6 shadow-sm">
          <ResendVerificationForm email={email} />
        </div>
        <div className="mt-6 text-center text-sm">
          <Link
            href="/sign-in"
            className="font-medium text-gray-950 underline-offset-4 hover:underline"
          >
            {t('verify.back')}
          </Link>
        </div>
      </div>
    </div>
  );
}
