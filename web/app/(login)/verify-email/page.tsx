import Link from 'next/link';
import { MailCheck } from 'lucide-react';
import { ResendVerificationForm } from './resend-verification-form';

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; error?: string }>;
}) {
  const { email = '', error } = await searchParams;

  return (
    <div className="min-h-[100dvh] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <MailCheck className="h-12 w-12 text-orange-500" />
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Verify your email
        </h2>
        <p className="mt-3 text-center text-sm text-gray-600">
          We sent a verification link to {email || 'your email address'}.
        </p>
        {error && (
          <p className="mt-3 text-center text-sm text-red-500">
            That verification link is invalid or expired. Request a new link
            below.
          </p>
        )}
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <ResendVerificationForm email={email} />
        <div className="mt-6 text-center text-sm">
          <Link
            href="/sign-in"
            className="font-medium text-orange-600 hover:text-orange-500"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
