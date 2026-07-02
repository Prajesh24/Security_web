import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { HttpError } from '../errors/http-error';
import { IS_PROD } from '../config';

/**
 * CSRF protection via the **double-submit cookie** pattern.
 *
 * Because the auth JWT lives in a cookie, the browser attaches it to *every*
 * request to our origin — including forged cross-site requests. To prove a
 * state-changing request really came from our own frontend we:
 *
 *   1. issue a random `csrfToken` in a readable (non-httpOnly) cookie, and
 *   2. require the SPA to echo that value in the `X-CSRF-Token` header.
 *
 * A malicious cross-site page can trigger a request (and the JWT cookie rides
 * along) but, due to the same-origin policy, it cannot read our csrf cookie,
 * so it cannot set the matching header. Mismatch → request rejected.
 */
const CSRF_COOKIE = 'csrfToken';
const CSRF_HEADER = 'x-csrf-token';

export function issueCsrfToken(_req: Request, res: Response): string {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false, // must be readable by our SPA to echo back
    secure: IS_PROD,
    sameSite: 'strict',
    path: '/',
  });
  return token;
}

export function csrfProtection(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  // Safe (read-only) methods don't change state and are exempt.
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }
  const cookieToken = (req as any).cookies?.[CSRF_COOKIE] as string | undefined;
  const headerToken = req.headers[CSRF_HEADER] as string | undefined;

  if (
    !cookieToken ||
    !headerToken ||
    cookieToken.length !== headerToken.length ||
    !crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))
  ) {
    return next(new HttpError(403, 'Invalid CSRF token.'));
  }
  next();
}
