import { Request, Response, NextFunction } from 'express';

/**
 * Structured access logging at the API gateway.
 *
 * The gateway sees every request, so it is the right place to log them — a
 * missing access log leaves you blind to abuse, bugs, and performance issues.
 * We log after the response finishes so we can record the status code and
 * latency. We deliberately record only metadata (method, path, status, client
 * IP, duration) and never request bodies, so credentials and PII are not
 * written to logs.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  // Skip health-check noise so real traffic stands out in the logs.
  if (req.path === '/api/health') return next();

  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    const line = `${new Date().toISOString()} ${req.method} ${req.originalUrl} ${
      res.statusCode
    } ${ms.toFixed(1)}ms ip=${req.ip}`;
    // eslint-disable-next-line no-console
    console.log(line);
  });

  next();
}
