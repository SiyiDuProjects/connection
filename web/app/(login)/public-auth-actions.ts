'use server';

import type { ActionState } from '@/lib/auth/middleware';

const unavailable = 'Account services are not connected in this local preview.';

export async function authenticate(previous: ActionState, data: FormData): Promise<ActionState> {
  if (!process.env.POSTGRES_URL) return { error: unavailable };
  const actions = await import('./actions');
  return (await actions.authenticate(previous, data)) ?? {};
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

export async function requestPasswordReset(previous: ActionState, data: FormData): Promise<ActionState> {
  if (!process.env.POSTGRES_URL) return { error: unavailable };
  const actions = await import('./password-reset-actions');
  try { return await actions.requestPasswordReset(previous, data); } catch {
    return { error: 'Password recovery is temporarily unavailable. Please try again later.' };
  }
}

export async function confirmPasswordReset(previous: ActionState, data: FormData): Promise<ActionState> {
  if (!process.env.POSTGRES_URL) return { error: unavailable };
  const actions = await import('./password-reset-actions');
  try { return await actions.confirmPasswordReset(previous, data); } catch {
    return { error: 'We could not update your password. Please try again.' };
  }
}
