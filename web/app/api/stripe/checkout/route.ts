import { setSession } from '@/lib/auth/session';
import { NextRequest, NextResponse } from 'next/server';
import { handleSuccessfulCheckoutSession } from '@/lib/payments/checkout';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sessionId = searchParams.get('session_id');

  if (!sessionId) {
    return NextResponse.redirect(new URL('/pricing', request.url));
  }

  try {
    const user = await handleSuccessfulCheckoutSession(sessionId);
    await setSession(user);
    return NextResponse.redirect(new URL('/dashboard', request.url));
  } catch (error) {
    console.error('Error handling successful checkout:', error);
    return NextResponse.redirect(new URL('/error', request.url));
  }
}
