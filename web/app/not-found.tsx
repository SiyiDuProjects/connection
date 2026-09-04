import Link from 'next/link';
import { buttonVariants } from '@heroui/styles';
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
          className={buttonVariants({ variant: 'primary' })}
        >
          {t('notFound.back')}
        </Link>
      </div>
    </div>
  );
}
