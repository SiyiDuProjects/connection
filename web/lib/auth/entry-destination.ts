import { safeAuthRedirect } from './verification-code';

export function signedInDestination(value: unknown) {
  const destination = safeAuthRedirect(value);
  const pathname = new URL(destination, 'https://reachard.co').pathname;
  return ['/sign-in', '/sign-up', '/verify-email', '/forgot-password', '/reset-password'].includes(pathname.replace(/\/$/, ''))
    ? '/dashboard' : destination;
}
