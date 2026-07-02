import { z } from 'zod';

/**
 * Strong password policy enforced at the edge with Zod:
 *  - at least 8 characters
 *  - upper + lower case, a digit, and a special character
 * This raises the cost of guessing/brute-force and rejects weak passwords.
 */
const strongPassword = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters') // bcrypt input limit
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain a special character');

export const RegisterDTO = z.object({
  fullName: z.string().min(2, 'Name is too short').max(80).trim(),
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: strongPassword,
});
export type RegisterDTO = z.infer<typeof RegisterDTO>;

export const LoginDTO = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required').max(72),
});
export type LoginDTO = z.infer<typeof LoginDTO>;
