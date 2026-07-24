# GadgetHub — Secure E-Commerce Store

A full-stack demonstration of **web application security** built for a security
assignment. Shoppers can browse an electronics catalogue, add items to a cart,
and check out; admins manage the product catalogue. Every action is protected
by a layered set of security controls.

- **Backend:** Node.js + Express + TypeScript + MongoDB (Mongoose), layered
  architecture (routes → controllers → services → repositories → models).
- **Frontend:** Next.js (App Router) + React + TypeScript.

---

## 1. Project structure

```
security web/
├── backend/                 # Express + TypeScript API
│   └── src/
│       ├── config/          # env-driven configuration
│       ├── database/        # MongoDB connection
│       ├── models/          # User, Product, Order, AuditLog
│       ├── dtos/            # Zod validation (auth password policy, product, checkout)
│       ├── repositories/    # data-access layer
│       ├── services/        # auth (lockout), product, order (server-side pricing), audit
│       ├── controllers/     # request handlers
│       ├── routes/          # route definitions
│       ├── middleware/      # auth, RBAC, rate-limit, CSRF, error handler
│       ├── utils/           # password hashing, JWT, input sanitization
│       ├── app.ts           # security middleware wiring (Helmet, CORS, …)
│       └── index.ts         # server bootstrap
└── frontend/                # Next.js app
    ├── app/                 # shop (/), login, register, cart, orders, admin
    └── lib/                 # api client (cookies + CSRF), client-side cart
```

---

## 2. Security features (what to write about in the report)

| # | Control | Where | What it defends against |
|---|---------|-------|--------------------------|
| 1 | **bcrypt password hashing** (salted, cost factor 12) | `utils/password.ts` | Credential theft if the DB leaks; rainbow tables |
| 2 | **Strong password policy** (8+, upper/lower/digit/special) | `dtos/auth.dto.ts` | Weak/guessable passwords |
| 3 | **JWT in httpOnly + SameSite=Strict + Secure cookie** | `controllers/auth.controller.ts` | Token theft via XSS; CSRF (SameSite) |
| 4 | **JWT access token (15-day lifetime, per CW2 baseline)** — theft risk contained by httpOnly + SameSite=Strict + Secure cookie | `config`, `utils/jwt.ts` | Session hijacking (defence is the cookie flags, not a short TTL) |
| 5 | **Per-account lockout** (10 fails → 15-min lock) | `services/auth.service.ts` | Online brute-force / password guessing |
| 6 | **Per-IP rate limiting** (global + strict auth limiter) | `middleware/rateLimit.middleware.ts` | Brute-force, credential stuffing, DoS |
| 7 | **RBAC** (customer vs admin) — only admins manage products | `middleware/rbac.middleware.ts` | Broken access control / privilege escalation |
| 8 | **CSRF protection** (double-submit cookie token) | `middleware/csrf.middleware.ts` | Cross-Site Request Forgery on checkout & admin actions |
| 9 | **Input validation** with Zod | `dtos/*` | Malformed input, type confusion |
| 10 | **NoSQL-injection sanitization** (strips `$` / `.` keys) | `utils/sanitize.ts` | MongoDB operator injection / auth bypass |
| 11 | **Server-side price authority** (client never sets prices) | `services/order.service.ts` | Price tampering / cart manipulation |
| 12 | **Atomic stock decrement** (conditional `$inc`) + rollback | `repositories/product.repository.ts` | Overselling, race conditions |
| 13 | **Ownership checks** (users see only their own orders) | `repositories/order.repository.ts` | IDOR / broken object-level authorization |
| 14 | **Security headers** via Helmet (CSP, HSTS, X-Frame-Options…) | `app.ts` | XSS, clickjacking, MIME sniffing |
| 15 | **CORS allowlist** with credentials | `app.ts` | Unauthorized cross-origin API use |
| 16 | **Audit logging** of security events | `services/audit.service.ts` | Non-repudiation, intrusion detection |
| 17 | **Generic error messages** (no user enumeration / stack traces) | `errorHandler.ts`, `auth.service.ts` | Information leakage |
| 18 | **Request body size cap (10 kb)** | `app.ts` | Large-payload denial of service |
| 19 | **Output encoding** (React auto-escapes all values) | frontend | Stored / reflected XSS |
| 20 | **Multi-factor authentication (TOTP)** with stepped login | `services/mfa.service.ts` | Credential theft / stolen-password reuse |
| 21 | **AES-256-GCM encryption at rest** for MFA secrets | `utils/crypto.ts` | Secret exposure if the DB leaks |
| 22 | **Self-hosted HMAC CAPTCHA** on register/login | `utils/captcha.ts` | Bots, automated brute force |
| 23 | **Strict-allowlist profile updates** | `dtos/profile.dto.ts` | Mass assignment / privilege escalation |
| 24 | **Data export/import** (minimised, profile-only import) | `services/user.service.ts` | Privacy / data portability |
| 25 | **Password reuse prevention + expiry + strength** | `services/auth.service.ts`, `utils/passwordStrength.ts` | Weak/recycled passwords |
| 26 | **IP allow-list / block-list** | `middleware/ipAccess.middleware.ts` | Network-level abuse; locked deployments |
| 27 | **Containerisation** (non-root multi-stage images) | `*/Dockerfile`, `docker-compose.yml` | Reproducible, least-privilege runtime |
| 28 | **CI/CD security gates** (audit, CodeQL, Gitleaks) | `.github/workflows/` | Vulnerable deps, secrets, insecure code |
| 29 | **Application-layer WAF** (attack-signature filter) | `middleware/waf.middleware.ts` | XSS, SQLi/NoSQLi, path traversal, SSTI, command injection, scanners |
| 30 | **SSRF-safe outbound fetch** (host allowlist + private-IP guard) | `utils/safeFetch.ts` | Server-Side Request Forgery, DNS rebinding |
| 31 | **OAuth 2.0 federated login** (Google, auth-code + `state`) | `services/oauth.service.ts` | Password reuse; delegates auth to a hardened IdP |
| 32 | **PII field encryption at rest** (AES-256-GCM: phone, address) | `utils/pii.ts` | Confidentiality of personal data if the DB leaks |
| 33 | **Gateway access logging** (metadata only, no PII) | `middleware/requestLogger.middleware.ts` | Blind spots: abuse, intrusion, performance |
| 34 | **Strict CORS** (allowlist function; `"null"` origin rejected) | `app.ts` | Credentialed cross-origin abuse from sandboxed pages |

See also **[SECURITY.md](SECURITY.md)**, **[docs/SECURITY-CONCEPTS.md](docs/SECURITY-CONCEPTS.md)**
(CIA triad, Laws of Nepal, CVSS, WAF/methodology write-ups for the report & viva),
and the rest of **[docs/](docs/)** (pentest report, report outline, references).

---

## 3. Prerequisites

- Node.js 18+ and npm
- MongoDB running locally on `mongodb://localhost:27017`

---

## 4. Running the project

### Backend

```bash
cd "security web/backend"
cp .env.example .env          # adjust JWT_SECRET etc. as needed
npm install
npm run seed                  # creates demo admin + shopper + 8 products
npm run dev                   # starts API on http://localhost:6060
```

### Frontend

```bash
cd "security web/frontend"
cp .env.local.example .env.local
npm install
npm run dev                   # starts the store on http://localhost:3000
```

Open **http://localhost:3000**.

### Or run everything with Docker

```bash
cp .env.example .env          # set JWT_SECRET and ENCRYPTION_KEY
docker compose up --build     # mongo + backend + frontend
docker compose exec backend node dist/seed.js   # seed demo data
```

> MongoDB is kept on the private compose network and is not published to the host.

### Demo accounts (created by `npm run seed`)

| Role | Email | Password | Can do |
|------|-------|----------|--------|
| Admin | `admin@gadgethub.test` | `Admin@123` | Manage products (`/admin`), view audit log |
| Shopper | `alice@gadgethub.test` | `Alice@123` | Browse, cart, checkout, view own orders |

> Passwords intentionally satisfy the strong-password policy.

---

## 5. How to demonstrate each control (for your report / viva)

1. **Password hashing** — inspect a user in MongoDB: `password` is a `$2a$12$…`
   bcrypt hash, never plaintext.
2. **httpOnly JWT** — after login, dev-tools → Application → Cookies: the
   `token` cookie shows `HttpOnly`, `SameSite=Strict`. JS `document.cookie`
   cannot read it.
3. **Account lockout** — 10 wrong passwords → account locked 15 min (`429`);
   the event appears in the admin audit log.
4. **Rate limiting** — rapidly hit `/api/auth/login` → `429 Too many attempts`.
5. **RBAC** — as a shopper, open `/admin` or `POST /api/products` → `403`.
   As admin → allowed.
6. **CSRF** — `POST /api/orders/checkout` **without** the `X-CSRF-Token`
   header → `403`; the real frontend includes it → success.
7. **NoSQL injection** — login with `{"email":{"$gt":""},"password":{"$gt":""}}`
   → sanitized → `401`, no bypass.
8. **Server-side pricing (price tampering)** — send a checkout item with an
   injected `"price":1` — the order still records the real DB price and total.
9. **Overselling** — order a quantity greater than stock → `400 Not enough
   stock`; stock never goes negative.
10. **Ownership / IDOR** — `/api/orders/me` only ever returns the caller's own
    orders (query is scoped to the authenticated user id).
11. **Security headers** — `curl -I http://localhost:6060/api/health` shows
    `Content-Security-Policy`, `X-Frame-Options`, `Strict-Transport-Security`, etc.
12. **Audit log** — sign in as admin → `GET /api/admin/audit-logs`: logins,
    failed attempts, lockouts, orders, and product changes are all recorded.

Example `curl` for the price-tampering + CSRF demos:

```bash
# Log in and capture cookies
curl -c c.txt -X POST http://localhost:6060/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@gadgethub.test","password":"Alice@123"}'
CSRF=$(grep csrfToken c.txt | awk '{print $7}')

# Price tampering — the injected price is ignored; server uses the real one
curl -b c.txt -X POST http://localhost:6060/api/orders/checkout \
  -H "Content-Type: application/json" -H "X-CSRF-Token: $CSRF" \
  -d '{"items":[{"productId":"<PRODUCT_ID>","quantity":1,"price":1}]}'

# Checkout without CSRF header (should be 403)
curl -b c.txt -X POST http://localhost:6060/api/orders/checkout \
  -H "Content-Type: application/json" \
  -d '{"items":[{"productId":"<PRODUCT_ID>","quantity":1}]}'
```

---

## 5b. Running the automated security tests

The backend ships an integration test suite (Node's built-in runner, no extra
deps) covering the WAF, CORS, security headers, OAuth, PII encryption, NoSQL
injection, mass assignment, session binding, brute-force and payload limits.

```bash
cd "security web/backend"
npm run seed                 # ensure demo data exists
RATE_LIMIT_DISABLED=true npm run dev   # terminal 1
npm run test:ci              # terminal 2 — runs the full suite
npm run typecheck            # optional: strict TypeScript check
```

CI runs the same steps automatically (see `.github/workflows/`).

---

## 6. Notes & limitations (be honest in your report)

- This is an **educational demo**, not production e-commerce software.
- Run it over **HTTPS** in production so `Secure` cookies and HSTS take effect
  (`NODE_ENV=production` enables the `Secure` cookie flag).
- Set a strong random `JWT_SECRET` in production (the app refuses to start with
  the default secret when `NODE_ENV=production`).
- Checkout uses atomic conditional stock updates with compensating rollback
  (oversell/race safe). For full cross-document ACID, deploy MongoDB as a
  replica set and wrap the order in a session transaction.
- `npm audit` on the frontend reports advisories only in the **build-time**
  `postcss` transitive dependency; these do not affect the running app.
