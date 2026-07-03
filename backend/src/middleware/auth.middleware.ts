import { Request, Response, NextFunction } from 'express';
import { verifyToken, fingerprintUserAgent } from '../utils/jwt';
import { HttpError } from '../errors/http-error';

/**
 * Authentication guard.
 *
 * The JWT is read from an httpOnly cookie (`token`). httpOnly means client
 * JavaScript cannot read it, which mitigates token theft via XSS. A short
 * expiry (see config) limits the damage if a token is ever leaked.
 */
export function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  try {
    const token = (req as any).cookies?.token as string | undefined;
    if (!token) {
      throw new HttpError(401, 'Authentication required.');
    }
    const payload = verifyToken(token);

    // Session binding: if the token was issued with a User-Agent fingerprint,
    // it must still match the current request's UA. A token lifted and replayed
    // from a different client/device fails this check.
    if (payload.uab) {
      const current = fingerprintUserAgent(req.headers['user-agent'] as string | undefined);
      if (current !== payload.uab) {
        throw new HttpError(401, 'Session is no longer valid. Please sign in again.');
      }
    }

    req.user = payload;
    next();
  } catch (err) {
    if (err instanceof HttpError) {
      next(err);
    } else {
      // jwt errors (expired/invalid) → generic 401, no internal detail leaked.
      next(new HttpError(401, 'Invalid or expired session.'));
    }
  }
}
