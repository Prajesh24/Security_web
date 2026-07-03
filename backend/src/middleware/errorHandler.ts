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

  // Errors thrown by body-parser and similar middleware carry their own HTTP
  // status (e.g. 413 payload-too-large, 400 malformed JSON). Honour a 4xx
  // client-error status with a clean, generic message instead of masking a
  // client mistake as a 500 server error.
  const status = (err as { status?: number; statusCode?: number })?.status
    ?? (err as { statusCode?: number })?.statusCode;
  if (typeof status === 'number' && status >= 400 && status < 500) {
    const type = (err as { type?: string })?.type;
    const message =
      type === 'entity.too.large'
        ? 'Request payload too large.'
        : status === 400
          ? 'Malformed request.'
          : 'Request rejected.';
    res.status(status).json({ success: false, message });
    return;
  }

  console.error('Unhandled error:', err);
  res.status(500).json({ success: false, message: 'Something went wrong.' });
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ success: false, message: 'Resource not found.' });
}
