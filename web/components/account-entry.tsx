'use client';

import Link from 'next/link';
import { Button, buttonVariants } from '@heroui/react';
import { ArrowUpRight } from 'lucide-react';
import { useCurrentUser } from '@/lib/auth/use-current-user';

export function AccountEntry({ size = 'md', variant = 'secondary' }: {
  size?: 'sm' | 'md' | 'lg'; variant?: 'primary' | 'secondary';
}) {
  const { data: user, isLoading, isValidating, error } = useCurrentUser();
  if (!user && (isLoading || isValidating) && !error) {
    return <Button size={size} variant={variant} isDisabled aria-label="Checking account">One moment…</Button>;
  }
  // A failed request is not evidence of a signed-out session. The protected
  // destination can resolve it without presenting a second registration form.
  const authenticated = Boolean(user) || Boolean(error);
  return <Link href={authenticated ? '/dashboard' : '/sign-up'} prefetch={false}
    className={buttonVariants({ size, variant })}>
    {authenticated ? 'Dashboard' : 'Get started'}<ArrowUpRight size={16} />
  </Link>;
}
