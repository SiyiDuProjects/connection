'use client';

import Link from 'next/link';
import { Chrome } from 'lucide-react';
import { buttonVariants } from '@heroui/styles';
import { cn } from '@/lib/utils';

export function ExtensionInstallLink({ className, label = 'Install extension', size = 'lg', variant = 'secondary' }: {
  className?: string;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'primary' | 'secondary';
}) {
  const storeUrl = String(process.env.NEXT_PUBLIC_CHROME_STORE_URL || '').trim();
  return (
    <Link href={storeUrl || '/#install'} target={storeUrl ? '_blank' : undefined}
      rel={storeUrl ? 'noopener noreferrer' : undefined}
      className={cn(buttonVariants({ variant, size }), 'gap-2', className)}>
      <Chrome className="size-4" aria-hidden="true" />{label}
    </Link>
  );
}
