import rateLimit from 'express-rate-limit';

/**
 * Global rate limiter — caps total requests per IP to blunt scraping and
 * denial-of-service attempts.
 */
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please slow down.' },
});

/**
 * Strict limiter for auth endpoints (login/register). This is the front line
 * against credential-stuffing and brute-force attacks: only a handful of
 * attempts per IP per window are allowed, independent of the per-account
 * lockout enforced in the auth service.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many attempts from this network. Try again later.',
  },
});
