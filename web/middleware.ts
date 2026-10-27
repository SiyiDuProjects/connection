import { publicUrl } from '@/lib/public-url';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { signToken, verifyToken } from '@/lib/auth/session';

const protectedRoutes = '/dashboard';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname=(request.headers.get('host')||request.nextUrl.host).split(':')[0].toLowerCase();
  if (hostname==='contacts.reachard.co' && ['/pricing','/connect-extension'].includes(pathname)) {
    return NextResponse.redirect(new URL(pathname+request.nextUrl.search,'https://reachard.co'),302);
  }
  const sessionCookie = request.cookies.get('session');
  const isProtectedRoute = pathname.startsWith(protectedRoutes);
  const signInUrl = publicUrl('/sign-in', request.url);
  signInUrl.searchParams.set('redirect', `${pathname}${request.nextUrl.search}`);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-pathname', pathname);

  if (isProtectedRoute && !sessionCookie) {
    return NextResponse.redirect(signInUrl);
  }

  let res = NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });

  if (sessionCookie && request.method === 'GET') {
    try {
      const parsed = await verifyToken(sessionCookie.value);
      const expiresInOneDay = new Date(Date.now() + 24 * 60 * 60 * 1000);

      res.cookies.set({
        name: 'session',
        value: await signToken({
          // Preserve the original session version; getUser compares it to the
          // account so refreshing a revoked cookie can never restore access.
          ...parsed,
          expires: expiresInOneDay.toISOString()
        }),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        expires: expiresInOneDay
      });
    } catch {
      if (isProtectedRoute) {
        res = NextResponse.redirect(signInUrl);
      }
      res.cookies.delete('session');
    }
  }

  if (pathname === '/reset-password') {
    res.headers.set('Referrer-Policy', 'no-referrer');
    res.headers.set('Cache-Control', 'no-store');
  }
  return res;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
  runtime: 'nodejs'
};
