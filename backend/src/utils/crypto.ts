import crypto from 'crypto';
import { ENCRYPTION_KEY } from '../config';

/**
 * Authenticated symmetric encryption for sensitive data at rest
 * (e.g. TOTP secrets). We use AES-256-GCM, which provides both
 * confidentiality and integrity (the auth tag detects tampering).
 *
 * Key management: the 256-bit key is derived from the ENCRYPTION_KEY
 * environment variable via SHA-256, so operators supply a single secret
 * and never a raw binary key. In production this secret must be stored in
 * a secrets manager / KMS, rotated periodically, and never committed.
 *
 * Ciphertext format (all hex, colon-separated):  iv:authTag:ciphertext
 */
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit nonce is the recommended size for GCM

// Derive a stable 32-byte key from the configured secret.
const key = crypto.createHash('sha256').update(ENCRYPTION_KEY).digest();

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return [iv.toString('hex'), authTag.toString('hex'), ciphertext.toString('hex')].join(':');
}

export function decrypt(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(':');
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error('Malformed ciphertext.');
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(dataHex, 'hex')),
    decipher.final(), // throws if the auth tag doesn't verify (tamper detection)
  ]);
  return plaintext.toString('utf8');
}
