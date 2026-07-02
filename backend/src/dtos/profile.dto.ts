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

/**
 * Import contract for a previously-exported data file. We only ever re-apply
 * the user's own *profile* (the same allowlist as an update); everything else
 * in an uploaded file — ids, roles, emails, order history — is ignored. The
 * wrapper is non-strict so extra top-level keys from the export envelope don't
 * fail the import, but the nested `profile` is validated by the strict allowlist.
 */
export const ProfileImportDTO = z.object({
  profile: UpdateProfileDTO,
});
export type ProfileImportDTO = z.infer<typeof ProfileImportDTO>;
