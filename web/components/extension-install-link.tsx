'use client';

import Link from 'next/link';
import { Chrome } from 'lucide-react';
import { buttonVariants } from '@heroui/styles';
import { cn } from '@/lib/utils';
import { CHROME_STORE_URL } from '@/lib/extension-store';

export function ExtensionInstallLink({ className, label = 'Install extension', size = 'lg', variant = 'secondary' }: {
  className?: string;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary';
}) {
  const storeUrl = CHROME_STORE_URL;
  return (
    <Link href={storeUrl} target="_blank"
      rel="noopener noreferrer"
      className={cn(buttonVariants({ variant, size }), 'gap-2', className)}>
      <Chrome className="size-4" aria-hidden="true" />{label}
    </Link>
  );
}
