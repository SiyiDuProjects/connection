'use client';

import { Card, Button, buttonVariants } from '@heroui/react';
import Link from 'next/link';
import { useFormStatus } from 'react-dom';
import { checkout } from '@/app/(dashboard)/pricing/checkout';
import { Brand, ThemeSwitch } from '@/components/reachard/design';

function ContinueButton() {
  const { pending } = useFormStatus();
  return <Button type="submit" fullWidth isPending={pending}>Continue to checkout</Button>;
}

export function ContinueCheckout({ priceId }: { priceId: string }) {
  return <main className="hu-auth">
    <header className="hu-auth-header"><Brand /><ThemeSwitch /></header>
    <div className="hu-auth-center"><Card className="hu-auth-card">
      <Card.Header><Card.Title>You're already signed in</Card.Title><Card.Description>Continue with your selected plan.</Card.Description></Card.Header>
      <Card.Content><form action={checkout}><input type="hidden" name="priceId" value={priceId} /><ContinueButton /></form></Card.Content>
      <Card.Footer><Link href="/dashboard" className={buttonVariants({ variant: 'tertiary' })}>Back to Dashboard</Link></Card.Footer>
    </Card></div>
  </main>;
}
