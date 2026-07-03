import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config';

export interface JwtPayload {
  id: string;
  role: 'customer' | 'admin';
  // Optional session-binding fingerprint (a hash of the User-Agent). When
  // present it ties the token to the browser that logged in, so a token
  // replayed from a different client is rejected.
  uab?: string;
}

/**
 * Derive a short, non-reversible fingerprint of the client's User-Agent. This
 * is a binding value, not a secret — it just has to change when the client does.
 */
export function fingerprintUserAgent(userAgent: string | undefined): string {
  return crypto
    .createHash('sha256')
    .update(userAgent || 'unknown')
    .digest('hex')
    .slice(0, 32);
}

/** Sign a short-lived JWT. Short expiry limits the window of a stolen token. */
export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
  } as SignOptions);
}

/** Verify and decode a JWT. Throws if invalid/expired. */
export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

/**
 * Short-lived, single-purpose token issued after a *password* check passes but
 * before the MFA code is verified. It carries a `purpose: 'mfa'` claim so it can
 * never be used as a full session token, and expires quickly to bound the
 * challenge window.
 */
export interface MfaChallengePayload {
  id: string;
  purpose: 'mfa';
}

export function signMfaChallenge(userId: string): string {
  return jwt.sign({ id: userId, purpose: 'mfa' } as MfaChallengePayload, JWT_SECRET, {
    expiresIn: '5m',
  });
}

export function verifyMfaChallenge(token: string): MfaChallengePayload {
  const decoded = jwt.verify(token, JWT_SECRET) as MfaChallengePayload;
  if (decoded.purpose !== 'mfa') {
    throw new Error('Not an MFA challenge token.');
  }
  return decoded;
}
