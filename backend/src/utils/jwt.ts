import jwt, { SignOptions } from 'jsonwebtoken';
import { JWT_SECRET, JWT_EXPIRES_IN } from '../config';

export interface JwtPayload {
  id: string;
  role: 'customer' | 'admin';
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
