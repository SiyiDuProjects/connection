'use client';
import { BRAND_NAME } from '@/lib/brand';

import { useActionState } from 'react';
import Link from 'next/link';
import { Alert, Button, Form, Separator } from '@heroui/react';
import { buttonVariants } from '@heroui/styles';
import { SettingsRow } from '@/components/settings-row';
import { openBillingPortal } from './actions';

export function BillingContent({ planName = 'No active plan', status = 'inactive', hasCustomer = false, isOwner = false, preview = false }: {
  planName?: string; status?: string; hasCustomer?: boolean; isOwner?: boolean; preview?: boolean;
}) {
  const [state, action, pending] = useActionState(openBillingPortal, {});
  const needsPayment = ['past_due', 'unpaid', 'incomplete'].includes(status);
  const statuses: Record<string, string> = { active: 'Active', trialing: 'Trial', past_due: 'Payment overdue', unpaid: 'Unpaid', incomplete: 'Payment incomplete', incomplete_expired: 'Checkout expired', canceled: 'Canceled', paused: 'Paused', inactive: 'Inactive' };
  return <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-5 pb-10 pt-4">
    {preview ? <p className="text-xs text-muted">Billing preview · no payment or account changes are made here.</p> : null}
    <p className="text-sm text-muted">Manage your membership, payment method and invoices.</p>
    <Separator />
    {needsPayment ? <Alert status="warning"><Alert.Indicator /><Alert.Content><Alert.Title>Update your payment method</Alert.Title><Alert.Description>Your payment needs attention. Open billing to review your invoice and payment method. Access depends on your paid membership period.</Alert.Description></Alert.Content></Alert> : null}
    <SettingsRow label="Membership" description={`${planName} · ${statuses[status] || 'Status unavailable'}`}>
      <p className="text-sm text-muted">Use the secure billing portal to view invoices, update your payment method or cancel renewal at the end of your billing period.</p>
      {hasCustomer && isOwner ? <Form action={preview ? undefined : action} onSubmit={preview ? event => event.preventDefault() : undefined}>
        <Button type="submit" variant="primary" isPending={pending} isDisabled={preview || pending}>Manage billing or cancel</Button>
      </Form> : !isOwner && hasCustomer ? <p className="text-sm text-muted">Ask the account owner to manage billing.</p> : <Link href="/pricing" className={buttonVariants({ variant: 'primary' })}>View plans</Link>}
      {state.error ? <Alert status="danger"><Alert.Indicator /><Alert.Content><Alert.Description>{state.error}</Alert.Description></Alert.Content></Alert> : null}
    </SettingsRow>
    <Separator />
    <SettingsRow label="Payment help" description="Questions about a charge, failed payment or refund?">
      <a className="text-sm text-accent underline" href={`mailto:support@reachard.co?subject=${encodeURIComponent(BRAND_NAME)}%20billing%20help`}>Contact billing support</a>
      <p className="text-sm text-muted">Include your account email and invoice number. Never send your password or full card number.</p>
    </SettingsRow>
  </div>;
}
