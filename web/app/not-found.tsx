import Link from 'next/link';
import { Compass } from 'lucide-react';
import { cookies, headers } from 'next/headers';
import { normalizeLanguage, translate } from '@/lib/i18n';

export default async function NotFound() {
  const language = normalizeLanguage((await cookies()).get('language')?.value || (await headers()).get('accept-language'));
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background text-foreground">
      <div className="max-w-md space-y-8 p-4 text-center">
        <div className="flex justify-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-[14px] bg-secondary text-foreground">
            <Compass className="h-6 w-6" />
          </span>
        </div>
        <h1 className="text-4xl font-semibold tracking-tight text-foreground">
          {t('notFound.title')}
        </h1>
        <p className="text-base font-medium leading-7 text-muted-foreground">
          {t('notFound.body')}
        </p>
        <Link
          href="/"
          className="mx-auto flex min-h-11 max-w-48 items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-[background,transform] duration-200 ease-out hover:bg-primary/90 active:scale-[0.98] focus:outline-none focus-visible:ring-[4px] focus-visible:ring-ring/30"
        >
          {t('notFound.back')}
        </Link>
      </div>
    </div>
  );
}
