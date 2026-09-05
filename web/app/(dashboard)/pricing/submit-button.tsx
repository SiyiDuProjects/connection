'use client';

import { Button } from '@heroui/react';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useFormStatus } from 'react-dom';
import { translate as t } from '@/lib/i18n';

export function SubmitButton({ plan, featured = false }: { plan: string; featured?: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="submit"
      isPending={pending}
      isDisabled={pending}
      variant={featured ? 'primary' : 'secondary'}
      size="lg"
      fullWidth
    >
      {pending ? (
        <>
          <Loader2 className="animate-spin mr-2 h-4 w-4" />
          {t('pricing.loading')}
        </>
      ) : (
        <>
          Get {plan}
          <ArrowRight className="ml-2 h-4 w-4" />
        </>
      )}
    </Button>
  );
}
