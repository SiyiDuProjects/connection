'use client';

import useSWR from 'swr';

export type CurrentUser = { id: number; name: string | null; email: string };

export async function fetchCurrentUser(url: string): Promise<CurrentUser | null> {
  const response = await fetch(url, { cache: 'no-store', credentials: 'same-origin' });
  if (!response.ok) throw new Error('Could not check your session.');
  return response.json();
}

export function useCurrentUser() {
  return useSWR<CurrentUser | null>('/api/user', fetchCurrentUser, { revalidateOnMount: true });
}
