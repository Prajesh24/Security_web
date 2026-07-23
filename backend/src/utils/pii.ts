import { encrypt, decrypt } from './crypto';
import { IUser } from '../models/user.model';

/**
 * Field-level encryption of personally-identifiable information (PII) at rest.
 *
 * The most sensitive contact/location data — phone number and postal address —
 * is stored AES-256-GCM encrypted (same authenticated cipher used for MFA
 * secrets), so a database dump does not expose it in plaintext. Encryption is
 * applied transparently:
 *   - on WRITE, the profile update patch is encrypted before it hits Mongo;
 *   - on READ, the repository decrypts before returning the document.
 *
 * The scheme is backward-compatible: a value that is not in ciphertext format
 * (e.g. legacy plaintext, or an empty string) is passed through unchanged, so
 * mixed data never breaks.
 */

// Dot-notated profile paths whose values are encrypted at rest.
export const ENCRYPTED_PII_PATHS = [
  'profile.phone',
  'profile.address.line1',
  'profile.address.city',
  'profile.address.postcode',
  'profile.address.country',
] as const;

// crypto.ts emits `iv:authTag:ciphertext`, all hex.
const CIPHERTEXT_RE = /^[0-9a-f]+:[0-9a-f]+:[0-9a-f]+$/i;

function isCiphertext(v: unknown): v is string {
  return typeof v === 'string' && CIPHERTEXT_RE.test(v);
}

function encryptValue(v: unknown): unknown {
  if (typeof v === 'string' && v.length > 0 && !isCiphertext(v)) return encrypt(v);
  return v;
}

function decryptValue(v: unknown): unknown {
  if (isCiphertext(v)) {
    try {
      return decrypt(v);
    } catch {
      return v; // tamper/format issue — fail closed to the stored value
    }
  }
  return v;
}

/** Encrypts the PII fields inside a dot-notated `$set` patch, in place. */
export function encryptProfilePatch(set: Record<string, unknown>): void {
  for (const path of ENCRYPTED_PII_PATHS) {
    if (path in set) set[path] = encryptValue(set[path]);
  }
}

/** Decrypts the PII fields on a fetched user document, in place. Safe on null. */
export function decryptUserPII<T extends IUser | null>(user: T): T {
  if (!user) return user;
  const profile = (user as IUser).profile as
    | { phone?: unknown; address?: Record<string, unknown> }
    | undefined;
  if (!profile) return user;

  if (profile.phone !== undefined) profile.phone = decryptValue(profile.phone) as string;
  if (profile.address) {
    for (const k of ['line1', 'city', 'postcode', 'country']) {
      if (profile.address[k] !== undefined) {
        profile.address[k] = decryptValue(profile.address[k]);
      }
    }
  }
  return user;
}
