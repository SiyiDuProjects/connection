import { cookies } from 'next/headers';
import { getUser } from '@/lib/db/queries';
import { connectGmail } from '@/lib/email/gmail';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const user = await getUser();
  const url = new URL(request.url);
  const code = url.searchParams.get('code') || '';
  const state = url.searchParams.get('state') || '';
  const storedState = (await cookies()).get('gmail_oauth_state')?.value || '';
  (await cookies()).delete('gmail_oauth_state');

  if (!user) return Response.redirect(new URL('/sign-in', appBaseUrl()), 302);
  if (!code || !state || state !== storedState) {
    return Response.redirect(new URL('/dashboard/activity?gmail=failed', appBaseUrl()), 302);
  }

  try {
    await connectGmail(user.id, code);
    return Response.redirect(new URL('/dashboard/activity?gmail=connected', appBaseUrl()), 302);
  } catch (error) {
    console.error('Gmail OAuth callback failed:', error);
    return Response.redirect(new URL('/dashboard/activity?gmail=failed', appBaseUrl()), 302);
  }
}

function appBaseUrl() {
  return process.env.NEXT_PUBLIC_WEB_BASE_URL || process.env.BASE_URL || 'http://localhost:3000';
}
