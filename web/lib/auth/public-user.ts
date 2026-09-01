import type { User } from '@/lib/db/schema';

export type PublicUser = Pick<User, 'id' | 'name' | 'email'>;

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email
  };
}
