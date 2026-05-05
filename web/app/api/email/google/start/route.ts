import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { getUser } from '@/lib/db/queries';
import { gmailAuthUrl, gmailConfigured } from '@/lib/email/gmail';

export const runtime = 'nodejs';

export async function GET() {
  const user = await getUser();
  if (!user) return Response.redirect(new URL('/sign-in', appBaseUrl()), 302);
  if (!gmailConfigured()) {
    return Response.json({ ok: false, error: 'Gmail OAuth is not configured.' }, { status: 503 });
  }

  const state = crypto.randomBytes(24).toString('base64url');
  (await cookies()).set('gmail_oauth_state', state, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 10 * 60,
    path: '/'
  });

  return Response.redirect(gmailAuthUrl(state), 302);
}

function appBaseUrl() {
  return process.env.NEXT_PUBLIC_WEB_BASE_URL || process.env.BASE_URL || 'http://localhost:3000';
}
