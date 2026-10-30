import { publicUrl } from '@/lib/public-url';
import { NextRequest, NextResponse } from 'next/server';
import { handleSuccessfulCheckoutSession } from '@/lib/payments/checkout';
import { getUser } from '@/lib/db/queries';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sessionId = searchParams.get('session_id');

  if (!sessionId) {
    return NextResponse.redirect(publicUrl('/pricing', request.url));
  }

  try {
    const signedInUser = await getUser();
    if (!signedInUser) {
      const signInUrl = publicUrl('/sign-in', request.url);
      signInUrl.searchParams.set('redirect', '/pricing');
      return NextResponse.redirect(signInUrl);
    }

    const user = await handleSuccessfulCheckoutSession(sessionId, {
      expectedUserId: signedInUser.id
    });
    if (!user) {
      return NextResponse.redirect(publicUrl('/pricing?checkout=pending', request.url));
    }
    return NextResponse.redirect(publicUrl('/dashboard', request.url));
  } catch (error) {
    console.error('Error handling successful checkout:', error);
    return NextResponse.redirect(publicUrl('/error', request.url));
  }
}
