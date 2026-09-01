import { NextRequest, NextResponse } from 'next/server';
import { handleSuccessfulCheckoutSession } from '@/lib/payments/checkout';
import { getUser } from '@/lib/db/queries';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sessionId = searchParams.get('session_id');

  if (!sessionId) {
    return NextResponse.redirect(new URL('/pricing', request.url));
  }

  try {
    const signedInUser = await getUser();
    if (!signedInUser) {
      const signInUrl = new URL('/sign-in', request.url);
      signInUrl.searchParams.set('redirect', '/pricing');
      return NextResponse.redirect(signInUrl);
    }

    const user = await handleSuccessfulCheckoutSession(sessionId, {
      expectedUserId: signedInUser.id
    });
    if (!user) {
      return NextResponse.redirect(new URL('/pricing?checkout=pending', request.url));
    }
    return NextResponse.redirect(new URL('/dashboard', request.url));
  } catch (error) {
    console.error('Error handling successful checkout:', error);
    return NextResponse.redirect(new URL('/error', request.url));
  }
}
