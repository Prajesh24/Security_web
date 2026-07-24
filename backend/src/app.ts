import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import { CORS_ALLOWLIST } from './config';
import { globalLimiter } from './middleware/rateLimit.middleware';
import { ipAccessControl } from './middleware/ipAccess.middleware';
import { requestLogger } from './middleware/requestLogger.middleware';
import { waf } from './middleware/waf.middleware';
import { sanitizeRequest } from './utils/sanitize';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

import authRoutes from './routes/auth.route';
import userRoutes from './routes/user.route';
import productRoutes from './routes/product.route';
import orderRoutes from './routes/order.route';
import adminRoutes from './routes/admin.route';

const app = express();

// Express sits behind a proxy in many deployments; trust it so req.ip and
// secure-cookie detection work correctly.
app.set('trust proxy', 1);

// ── Network access control ────────────────────────────────────────────────────
// Deny-by-default allowlist + explicit blocklist, evaluated before anything else.
app.use(ipAccessControl);

// ── Access logging (gateway) ──────────────────────────────────────────────────
// The gateway sees every request; log metadata here for abuse/perf visibility.
app.use(requestLogger);

// ── Security headers (Helmet) ─────────────────────────────────────────────────
// Sets a strict Content-Security-Policy, HSTS, X-Content-Type-Options,
// X-Frame-Options (clickjacking), Referrer-Policy, and removes X-Powered-By.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        baseUri: ["'self'"], // block <base> hijacking
        formAction: ["'self'"], // forms can only post to us
        frameSrc: ["'none'"],
        frameAncestors: ["'none'"], // anti-clickjacking
      },
    },
    // Force HTTPS for a year (with subdomains) once served over TLS.
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    crossOriginResourcePolicy: { policy: 'same-site' },
  }),
);

// Disable powerful browser features we never use (least privilege at the UA).
app.use((_req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  next();
});

// ── CORS allowlist ────────────────────────────────────────────────────────────
// Only known frontend origins may call the API, and credentials (cookies) are
// only shared with them. The reflected-origin function NEVER echoes an
// arbitrary or "null" origin (sandboxed iframes / file://), which would let a
// malicious page make credentialed cross-origin calls.
app.use(
  cors({
    origin(origin, callback) {
      // Same-origin / non-browser tools (curl, health checks) send no Origin.
      if (!origin) return callback(null, true);
      if (origin !== 'null' && CORS_ALLOWLIST.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false); // reject: no CORS headers are sent back
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-CSRF-Token'],
  }),
);

// ── Parsers ───────────────────────────────────────────────────────────────────
// Body size cap mitigates large-payload DoS.
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));
app.use(cookieParser());

// ── Input hardening ─────────────────────────────────────────────────────────
app.use(sanitizeRequest); // strips NoSQL-injection operators from the body
app.use(waf); // app-layer WAF: blocks known attack signatures (defence in depth)
app.use(globalLimiter); // global rate limiting

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'GadgetHub API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);

// ── Fallbacks ─────────────────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
