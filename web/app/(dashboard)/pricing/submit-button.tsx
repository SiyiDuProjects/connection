'use client';

import { Button } from '@/components/ui/button';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useFormStatus } from 'react-dom';
import { useI18n } from '@/components/language-provider';

export function SubmitButton() {
  const { pending } = useFormStatus();
  const { t } = useI18n();

  return (
    <Button
      type="submit"
      disabled={pending}
      variant="outline"
      className="w-full rounded-full"
    >
      {pending ? (
        <>
          <Loader2 className="animate-spin mr-2 h-4 w-4" />
          {t('pricing.loading')}
        </>
      ) : (
        <>
          {t('pricing.getStarted')}
          <ArrowRight className="ml-2 h-4 w-4" />
        </>
      )}
    </Button>
  );
}
