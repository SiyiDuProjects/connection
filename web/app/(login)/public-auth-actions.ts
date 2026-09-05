'use server';

import type { ActionState } from '@/lib/auth/middleware';

const unavailable = 'Account services are not connected in this local preview.';

export async function checkAccountStatus(email: string) {
  if (!process.env.POSTGRES_URL) return { error: unavailable };
  const actions = await import('./actions');
  return actions.checkAccountStatus(email);
}

export async function signIn(previous: ActionState, data: FormData): Promise<ActionState> {
  if (!process.env.POSTGRES_URL) return { error: unavailable };
  const actions = await import('./actions');
  return (await actions.signIn(previous, data)) ?? {};
}

export async function signUp(previous: ActionState, data: FormData): Promise<ActionState> {
  if (!process.env.POSTGRES_URL) return { error: unavailable };
  const actions = await import('./actions');
  return actions.signUp(previous, data);
}

export async function resendVerification(previous: ActionState, data: FormData): Promise<ActionState> {
  if (!process.env.POSTGRES_URL) return { error: unavailable };
  const actions = await import('./actions');
  try { return await actions.resendVerification(previous, data); } catch {
    return { error: 'We could not send your code. Please try again.' };
  }
}

export async function confirmVerification(previous: ActionState, data: FormData): Promise<ActionState> {
  if (!process.env.POSTGRES_URL) return { error: unavailable };
  const actions = await import('./actions');
  return (await actions.confirmVerification(previous, data)) ?? {};
}
