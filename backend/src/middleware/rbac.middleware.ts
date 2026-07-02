import { Request, Response, NextFunction } from 'express';
import { HttpError } from '../errors/http-error';

/**
 * Role-Based Access Control. Must run after authMiddleware. Restricts a route
 * to the given roles — e.g. the admin audit log is `requireRole('admin')`.
 * Enforcing authorization on the server (never trusting the client) is what
 * prevents privilege-escalation / broken-access-control attacks.
 */
export function requireRole(...roles: Array<'customer' | 'admin'>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new HttpError(401, 'Authentication required.'));
    }
    if (!roles.includes(req.user.role)) {
      return next(new HttpError(403, 'You do not have access to this resource.'));
    }
    next();
  };
}
