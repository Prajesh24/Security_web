import { RequestHandler } from 'express';
import rateLimit from 'express-rate-limit';
import { RATE_LIMIT_DISABLED } from '../config';

// In the test environment the limiters are replaced with a passthrough so the
// suite can make many auth calls without being throttled (see RATE_LIMIT_DISABLED).
// This is gated to non-production only.
const passthrough: RequestHandler = (_req, _res, next) => next();

/**
 * Global rate limiter — caps total requests per IP to blunt scraping and
 * denial-of-service attempts.
 */
export const globalLimiter: RequestHandler = RATE_LIMIT_DISABLED
  ? passthrough
  : rateLimit({
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
export const authLimiter: RequestHandler = RATE_LIMIT_DISABLED
  ? passthrough
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 10,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        message: 'Too many attempts from this network. Try again later.',
      },
    });

/**
 * Limiter for checkout/payment. Independent of the per-account/per-IP auth
 * limiters: without it, an authenticated attacker could rapidly try many
 * stolen card numbers against the checkout endpoint (card testing / carding).
 */
export const paymentLimiter: RequestHandler = RATE_LIMIT_DISABLED
  ? passthrough
  : rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 20,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        success: false,
        message: 'Too many payment attempts. Please try again later.',
      },
    });
