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
    <div className="flex min-h-[100dvh] flex-col justify-center bg-gray-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <MailCheck className="h-12 w-12 text-gray-950" />
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
        <div className="border border-gray-200 bg-white p-6 shadow-sm">
          <ResendVerificationForm email={email} />
        </div>
        <div className="mt-6 text-center text-sm">
          <Link
            href="/sign-in"
            className="font-medium text-gray-950 underline-offset-4 hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
