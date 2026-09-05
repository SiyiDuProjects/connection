'use server';

// Keep the public marketing page usable without loading billing credentials.
// The existing action still enforces authentication and validates the Stripe price.
export async function checkout(formData: FormData) {
  const { checkoutAction } = await import('@/lib/payments/actions');
  await checkoutAction(formData);
}
