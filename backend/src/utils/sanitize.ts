import { Request, Response, NextFunction } from 'express';

/**
 * NoSQL-injection guard.
 *
 * MongoDB query operators start with `$` and nested-path injection uses `.`.
 * An attacker could send `{ "email": { "$gt": "" } }` as a login body to
 * bypass equality checks. This middleware recursively strips any object key
 * that begins with `$` or contains `.` from the request body, so user input
 * can never inject query operators.
 */
function scrub(value: any): any {
  if (Array.isArray(value)) {
    return value.map(scrub);
  }
  if (value !== null && typeof value === 'object') {
    const clean: Record<string, any> = {};
    for (const key of Object.keys(value)) {
      if (key.startsWith('$') || key.includes('.')) {
        // Drop dangerous keys entirely.
        continue;
      }
      clean[key] = scrub(value[key]);
    }
    return clean;
  }
  return value;
}

export function sanitizeRequest(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  if (req.body && typeof req.body === 'object') {
    req.body = scrub(req.body);
  }
  next();
}
