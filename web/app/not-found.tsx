import Link from 'next/link';
import { CircleIcon } from 'lucide-react';
import { cookies, headers } from 'next/headers';
import { normalizeLanguage, translate } from '@/lib/i18n';

export default async function NotFound() {
  const language = normalizeLanguage((await cookies()).get('language')?.value || (await headers()).get('accept-language'));
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);

  return (
    <div className="flex items-center justify-center min-h-[100dvh]">
      <div className="max-w-md space-y-8 p-4 text-center">
        <div className="flex justify-center">
          <CircleIcon className="size-12 text-gray-950" />
        </div>
        <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
          {t('notFound.title')}
        </h1>
        <p className="text-base text-gray-500">
          {t('notFound.body')}
        </p>
        <Link
          href="/"
          className="mx-auto flex max-w-48 justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-950 focus:ring-offset-2"
        >
          {t('notFound.back')}
        </Link>
      </div>
    </div>
  );
}
