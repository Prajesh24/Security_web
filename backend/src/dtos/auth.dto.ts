import { z } from 'zod';
import { isCommonPassword } from '../utils/passwordStrength';

/**
 * Strong password policy enforced at the edge with Zod:
 *  - at least 8 characters
 *  - upper + lower case, a digit, and a special character
 *  - not a well-known / common password
 * This raises the cost of guessing/brute-force and rejects weak passwords.
 */
const strongPassword = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be at most 72 characters') // bcrypt input limit
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain a special character')
  .refine((p) => !isCommonPassword(p), 'That password is too common — choose another');

export const RegisterDTO = z.object({
  fullName: z.string().min(2, 'Name is too short').max(80).trim(),
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: strongPassword,
});
export type RegisterDTO = z.infer<typeof RegisterDTO>;

export const ChangePasswordDTO = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required').max(72),
    newPassword: strongPassword,
  })
  .refine((d) => d.currentPassword !== d.newPassword, {
    message: 'New password must be different from the current one',
    path: ['newPassword'],
  });
export type ChangePasswordDTO = z.infer<typeof ChangePasswordDTO>;

export const LoginDTO = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  password: z.string().min(1, 'Password is required').max(72),
});
export type LoginDTO = z.infer<typeof LoginDTO>;

// A TOTP code is always exactly six digits.
const totpCode = z.string().regex(/^\d{6}$/, 'Enter the 6-digit code');

export const MfaLoginDTO = z.object({
  mfaToken: z.string().min(1),
  code: totpCode,
});
export type MfaLoginDTO = z.infer<typeof MfaLoginDTO>;

export const MfaCodeDTO = z.object({ code: totpCode });
export type MfaCodeDTO = z.infer<typeof MfaCodeDTO>;

export const MagicRequestDTO = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
});
export type MagicRequestDTO = z.infer<typeof MagicRequestDTO>;

export const MagicVerifyDTO = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/, 'Invalid token'),
});
export type MagicVerifyDTO = z.infer<typeof MagicVerifyDTO>;
