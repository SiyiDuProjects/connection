import { z } from 'zod';

// bcrypt hashes at most 72 UTF-8 bytes. Reject longer *new* passwords rather
// than silently accepting two different strings as the same credential.
export function isSupportedNewPassword(password: string) {
  return password.length >= 8 && password.length <= 100
    && new TextEncoder().encode(password).byteLength <= 72;
}

export const newPasswordSchema = z.string()
  .min(8, 'Use at least 8 characters.')
  .max(100, 'Use a shorter password.')
  .refine(value => new TextEncoder().encode(value).byteLength <= 72,
    'Use a password of at most 72 UTF-8 bytes; accented characters and emoji use more than one byte.');
