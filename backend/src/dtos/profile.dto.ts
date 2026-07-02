import { z } from 'zod';

/**
 * Profile update contract — the primary mass-assignment defence.
 *
 * Only these explicitly-listed, non-privileged fields may ever be set by a
 * user. Security-relevant attributes (role, email, password, mfaEnabled,
 * lockout counters, _id) are simply absent from the schema, and `.strict()`
 * makes any unexpected key a hard validation error rather than silently
 * ignoring it. So a payload like `{ "role": "admin" }` is rejected outright —
 * there is no path by which a client can escalate privilege through this route.
 */
const shortText = z.string().trim().max(120);

export const UpdateProfileDTO = z
  .object({
    displayName: shortText.optional(),
    bio: z.string().trim().max(280).optional(),
    phone: z
      .string()
      .trim()
      .max(20)
      .regex(/^[+\d][\d\s-]*$/, 'Invalid phone number')
      .or(z.literal(''))
      .optional(),
    address: z
      .object({
        line1: shortText.optional(),
        city: shortText.optional(),
        postcode: shortText.optional(),
        country: shortText.optional(),
      })
      .strict()
      .optional(),
    preferences: z
      .object({
        currency: z.enum(['NPR', 'USD', 'EUR', 'GBP']).optional(),
        marketingEmails: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type UpdateProfileDTO = z.infer<typeof UpdateProfileDTO>;
