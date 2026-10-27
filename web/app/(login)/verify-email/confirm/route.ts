import { publicUrl } from '@/lib/public-url';
import { NextRequest, NextResponse } from 'next/server';
import { setSession } from '@/lib/auth/session';
import { verifyEmailToken } from '@/lib/auth/email-verification';

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(
      publicUrl('/verify-email?error=missing', request.url)
    );
  }

  const user = await verifyEmailToken(token);
  if (!user) {
    return NextResponse.redirect(
      publicUrl('/verify-email?error=invalid', request.url)
    );
  }

  await setSession(user);
  return NextResponse.redirect(publicUrl('/dashboard', request.url));
}
