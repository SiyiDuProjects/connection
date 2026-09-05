'use client';

import Link from 'next/link';
import { Compass } from 'lucide-react';
import { buttonVariants } from '@heroui/react';
import { EmptyState } from '@heroui-pro/react';
import { translate as t } from '@/lib/i18n';

export default function NotFound() {
  return <main className="flex min-h-dvh items-center justify-center px-5">
    <EmptyState className="max-w-md">
      <EmptyState.Header>
        <EmptyState.Media variant="icon"><Compass /></EmptyState.Media>
        <EmptyState.Title>{t('notFound.title')}</EmptyState.Title>
        <EmptyState.Description>{t('notFound.body')}</EmptyState.Description>
      </EmptyState.Header>
      <EmptyState.Content><Link href="/" className={buttonVariants()}>{t('notFound.back')}</Link></EmptyState.Content>
    </EmptyState>
  </main>;
}
