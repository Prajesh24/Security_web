import bcrypt from 'bcryptjs';
import { BCRYPT_ROUNDS } from '../config';

/**
 * Hash a plaintext password with bcrypt. bcrypt is a deliberately slow,
 * salted, adaptive hash — the BCRYPT_ROUNDS cost factor makes brute-force
 * and rainbow-table attacks expensive. Never store plaintext passwords.
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

/** Constant-time comparison of a plaintext password against a stored hash. */
export async function verifyPassword(
  plain: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
