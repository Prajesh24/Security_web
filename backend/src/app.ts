import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import { CLIENT_URL } from './config';
import { globalLimiter } from './middleware/rateLimit.middleware';
import { ipAccessControl } from './middleware/ipAccess.middleware';
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
        frameAncestors: ["'none'"], // anti-clickjacking
      },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
  }),
);

// ── CORS allowlist ────────────────────────────────────────────────────────────
// Only our known frontend origin may call the API, and credentials (cookies)
// are only shared with it.
app.use(
  cors({
    origin: CLIENT_URL,
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
app.use(globalLimiter); // global rate limiting

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'GadgetHub API is running 🛒🔒' });
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
