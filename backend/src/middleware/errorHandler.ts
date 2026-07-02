import { Request, Response, NextFunction } from 'express';
import { HttpError } from '../errors/http-error';

/**
 * Central error handler. Returns clean, generic messages to the client and
 * never exposes stack traces or internal details (information-leakage
 * prevention). Full details are logged server-side only.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    res.status(err.statusCode).json({ success: false, message: err.message });
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Something went wrong.' });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ success: false, message: 'Resource not found.' });
}
