import type Stripe from 'stripe';

export function stripeObjectId(value: unknown): string | null {
  if (typeof value === 'string' && value) return value;
  if (value && typeof value === 'object' && 'id' in value && typeof value.id === 'string') return value.id;
  return null;
}
export function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  if (invoice.parent?.type === 'subscription_details') {
    return stripeObjectId(invoice.parent.subscription_details?.subscription);
  }
  // Existing webhook destinations may still deliver a pre-Basil payload.
  return stripeObjectId((invoice as unknown as { subscription?: unknown }).subscription);
}
export function isTerminalSubscription(status: string): boolean {
  return ['canceled', 'incomplete_expired'].includes(status);
}
export function canFulfillCheckout(session: Stripe.Checkout.Session, subscription: Stripe.Subscription): boolean {
  return session.mode === 'subscription' && session.status === 'complete'
    && ['paid', 'no_payment_required'].includes(session.payment_status)
    && ['active', 'trialing'].includes(subscription.status)
    && stripeObjectId(session.customer) === stripeObjectId(subscription.customer);
}
export function isPaidRewardInvoice(invoice: Stripe.Invoice): boolean {
  return invoice.status === 'paid' && invoice.amount_paid > 0;
}
export function isMonthlyPrice(price: Stripe.Price): boolean {
  return price.type === 'recurring' && price.recurring?.interval === 'month'
    && price.recurring.interval_count === 1 && price.billing_scheme === 'per_unit'
    && price.recurring.usage_type === 'licensed' && price.unit_amount !== null;
}

export function invoiceLinePriceId(line: Stripe.InvoiceLineItem | undefined): string | null {
  return stripeObjectId(line?.pricing?.price_details?.price)
    || stripeObjectId((line as unknown as { price?: unknown } | undefined)?.price);
}

export function isMembershipInvoiceLine(line: Stripe.InvoiceLineItem, subscriptionId: string, allowProration = false): boolean {
  const legacy = line as unknown as { type?: string; subscription?: unknown; proration?: boolean;
    proration_details?: { credited_items?: unknown } };
  const item = line.parent?.type === 'subscription_item_details' ? line.parent.subscription_item_details : null;
  if (line.amount < 0 || item?.proration_details?.credited_items || legacy.proration_details?.credited_items) return false;
  if (line.quantity != null && line.quantity !== 1) return false;
  if (!invoiceLinePriceId(line)) return false;
  return item ? (allowProration || !item.proration) && stripeObjectId(item.subscription) === subscriptionId
    : legacy.type === 'subscription' && (allowProration || !legacy.proration)
      && (!legacy.subscription || stripeObjectId(legacy.subscription) === subscriptionId);
}
