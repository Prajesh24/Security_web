import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
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
    req.user = verifyToken(token);
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
