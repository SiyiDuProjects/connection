import { User } from '@/lib/db/schema';

const DEFAULT_ADMIN_EMAIL = 'ducaesarsiyi@outlook.com';

export function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || DEFAULT_ADMIN_EMAIL)
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminUser(user: Pick<User, 'email'> | null | undefined) {
  if (!user?.email) return false;
  return getAdminEmails().includes(user.email.toLowerCase());
}
