# GadgetHub — Security Concepts for the Report & Viva

This document maps the **ST6005CEM CW2** assessment requirements to the concrete
controls in this codebase, and provides the background you need to *defend* each
one in the viva. Where a requirement is a concept rather than code, the relevant
talking points are given.

---

## 1. The CIA triad — how GadgetHub upholds it

| Pillar | Meaning | Controls in this project |
|--------|---------|--------------------------|
| **Confidentiality** | Only authorised parties can read data | bcrypt password hashing; JWT in httpOnly cookie; **AES-256-GCM encryption at rest** for MFA secrets *and* PII (phone/address, `utils/pii.ts`); TLS/HTTPS in production; RBAC; strict CORS; generic errors (no leakage) |
| **Integrity** | Data cannot be tampered with undetected | **Server-side price authority** (client never sets prices); atomic stock decrement; CSRF double-submit token; AES-GCM **auth tag** detects ciphertext tampering; audit log (non-repudiation); input validation (Zod) |
| **Availability** | The service stays up for legitimate users | Per-IP + per-account **rate limiting**; account lockout; 10 kb body cap; **WAF**; health checks + container restart policies |

**Viva point:** every control can be tied back to one or more CIA pillars —
lead with the pillar, then name the control.

---

## 2. Laws of Nepal (legal & regulatory context)

Discuss GadgetHub as a Nepal-based e-commerce operator subject to:

- **Electronic Transactions Act, 2063 (2008)** — Nepal's principal cyber-law.
  Gives legal recognition to electronic records/signatures and **criminalises
  unauthorised access, data theft and tampering** (§47 etc.). Our audit log,
  access control and integrity controls support compliance and evidence.
- **Individual Privacy Act, 2075 (2018)** and its Rules 2077 — require
  **consent, purpose limitation, data minimisation and security safeguards** for
  personal data. Mapped to: PII encryption at rest, data-export/minimised-import,
  and not logging PII at the gateway.
- **Consumer Protection Act, 2075 (2018)** — fair pricing and honest
  transactions → server-side pricing prevents a tampered total being charged.
- **National Cyber Security Policy, 2080 (2023)** — national direction on
  defence-in-depth, incident response and secure development.

**Viva point:** connect a *specific* control to a *specific* legal duty (e.g.
"PII encryption at rest operationalises the security-safeguard duty under the
Privacy Act 2075").

---

## 3. Authentication strength — 2FA minimum

Implemented as **TOTP MFA** (`services/mfa.service.ts`): stepped login (password
first, then a 6-digit authenticator code), secret stored **AES-256-GCM
encrypted**, and the verify step is rate-limited so the 6-digit code cannot be
brute forced. **OAuth 2.0** (below) is offered as an additional/alternative
strong-auth path.

## 4. Transport & data-at-rest encryption (HTTPS + AES)

- **In transit:** run behind **HTTPS/TLS** in production (`NODE_ENV=production`
  turns on the `Secure` cookie flag and HSTS via Helmet). *TLS everywhere* —
  including between internal services — see the deployment note in §Common
  Mistakes.
- **At rest:** **AES-256-GCM** (authenticated encryption) for MFA secrets and
  now **PII** (phone, address) via `utils/pii.ts`. The key is derived from
  `ENCRYPTION_KEY`; in production this belongs in a secrets manager/KMS and must
  be rotated. Verify it works: `db.users.findOne()` in mongosh shows
  `iv:tag:ciphertext`, never plaintext.

## 5. WAF — Web Application Firewall

**Two layers, defence-in-depth:**
1. **Edge WAF (production):** put **Cloudflare** (or AWS WAF) in front of the
   app. It provides managed OWASP rulesets, bot mitigation, TLS termination and
   L3/L7 DDoS protection *before* traffic reaches origin. Document this as the
   primary WAF for deployment.
2. **Application-layer WAF (in this repo):** `middleware/waf.middleware.ts`
   inspects each request for unambiguous attack signatures (XSS, SQLi/NoSQLi,
   path traversal, SSTI, command injection) and known scanner user-agents, and
   returns a generic `403`. It is deliberately conservative to avoid blocking
   legitimate shopper input.

## 6–7. Penetration-testing methodology (scope discipline)

- **Active reconnaissance only** — the assignment permits active recon (directed
  probing/enumeration of *your own* app: endpoint discovery, input fuzzing,
  header inspection). Document tools/steps used against `localhost` only.
- **Skip post-exploitation** — do **not** perform privilege-escalation
  persistence, lateral movement, or data exfiltration beyond proving a finding.
  Demonstrate the vulnerability, assess impact, then **stop** and recommend a
  fix. Keep everything within authorised scope.

## 8. CVSS v3.1 (and defending it in the viva)

Every finding in [PENTEST-REPORT.md](PENTEST-REPORT.md) carries a **CVSS v3.1
vector + score**. Be ready to justify each metric. Worked example:

> **Reflected input without output encoding** →
> `CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:L/A:N` → **5.4 (Medium)**
> - **AV:N** network-reachable, **AC:L** no special conditions, **PR:N** no auth
>   needed, **UI:R** victim must click a crafted link, **S:U** stays in the app's
>   scope, **C:L/I:L** limited read/modify in the victim's session, **A:N** no
>   availability impact.

**Viva prep:** for each vector, be able to say *why* each metric is the value it
is, and how the fix lowers the score (e.g. output encoding drops C/I to `N`).

## 9. White-box testing + NoSQL injection

CW2 is **white-box** (you have full source access). The headline injection class
for a MongoDB stack is **NoSQL operator injection** (e.g. `{"$gt":""}` to bypass
auth). **Mitigation:** `utils/sanitize.ts` strips `$`/`.`-prefixed keys from
input, DTOs coerce credentials to strings, and queries use equality on validated
strings — so an operator object can never reach the query. Regression-tested in
`tests/` ("NoSQL operator injection cannot bypass login").

## 10. Content-Security-Policy (CSP)

Set via Helmet in `app.ts`: `default-src 'self'`, `script-src 'self'`
(no inline/remote scripts), `object-src 'none'`, `frame-ancestors 'none'`
(anti-clickjacking). CSP is the second line of defence against XSS after React's
output encoding.

## 11. CSRF protection

**Double-submit-cookie** pattern (`middleware/csrf.middleware.ts`): a readable
`csrfToken` cookie must be echoed in the `X-CSRF-Token` header on every
state-changing request; the server compares them. Combined with
`SameSite=Strict` on the auth cookie, cross-site forgery of checkout/admin
actions fails.

## 12. SSRF protection (allowlisting)

`utils/safeFetch.ts` makes any outbound request SSRF-safe: **protocol allowlist**
(http/https only), **host allowlist** (`OUTBOUND_HOST_ALLOWLIST`, deny by
default), **DNS-resolution guard** rejecting private/loopback/link-local/cloud-
metadata addresses (defeats DNS rebinding), and **no auto-redirects**. There is
currently no user-controlled outbound request, so this is preventative/by-design.

## 13. OAuth 2.0 (federated login)

**Authorization-Code flow** with Google (`services/oauth.service.ts`,
`controllers/auth.controller.ts`):
1. `/api/auth/oauth/google` sets a random **`state`** (httpOnly, SameSite=Lax
   cookie) and redirects to Google's consent screen.
2. Google redirects back to `/api/auth/oauth/google/callback`; the server
   **verifies `state`** (CSRF defence for the flow), exchanges the code for
   tokens **server-side** (client secret never touches the browser), fetches the
   verified profile, find-or-creates a **passwordless** local account, then
   issues our own httpOnly JWT session.

**Setup (needed for it to actually run):**
1. Google Cloud Console → *APIs & Services → Credentials → Create OAuth client
   ID → Web application*.
2. Authorised redirect URI: `http://localhost:6060/api/auth/oauth/google/callback`.
3. Put the values in `backend/.env`:
   ```
   GOOGLE_CLIENT_ID=...apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=...
   # optional override: GOOGLE_REDIRECT_URI=...
   ```
4. Restart the backend. The login page auto-shows **"Continue with Google"**
   (it reads `/api/auth/providers`). Until configured, the flow is disabled and
   the rest of the app is unaffected.

## 14. Generic error handling (no stack traces to the client)

`middleware/errorHandler.ts` returns a **generic message + status code**; stack
traces and internal details are logged server-side only. Prevents information
leakage / fingerprinting. (The WAF and auth errors follow the same principle.)

## 15. "Don't use a template"

The app is **built from scratch** in a layered architecture
(routes → controllers → services → repositories → models) rather than cloned
from a starter template — so every security decision is deliberate and
explainable, which is exactly what a white-box viva probes.

## 16. CORS — the common bug, and how we prevent it

**The bug:** reflecting the request's `Origin` back into
`Access-Control-Allow-Origin` (especially the literal **`"null"`** origin, sent
by sandboxed iframes / `file://`) *together with* `credentials: true` lets a
malicious page make authenticated cross-origin calls. **Never allow `null`.**
`app.ts` uses an **origin allowlist function** that returns CORS headers only for
configured origins and **explicitly rejects `"null"`** and everything else.
Verified: `Origin: null` receives no `Access-Control-Allow-Origin` header.

---

## Common deployment mistakes — status in this project

| Mistake | Status / mitigation |
|---------|---------------------|
| **DB exposed to the internet** (Mongo 27017…) | `docker-compose.yml` keeps Mongo on a private network — **not published to the host**. Locally it binds `127.0.0.1`. Never expose 27017/6379/5432 publicly. |
| **No health checks** | `/api/health` endpoint + Docker healthchecks so orchestrators/LBs detect a dead instance. |
| **Auth duplicated per service** | Single, centralised auth (JWT verification middleware). In a microservice split, validate JWTs **once at the API gateway**, not in every service. |
| **No rate limiting** | Global + strict auth limiters (`middleware/rateLimit.middleware.ts`); the gateway is the right enforcement point. |
| **Plain HTTP internally** | Use **TLS everywhere**, including service-to-service — internal networks do get compromised. |
| **No gateway logging** | `middleware/requestLogger.middleware.ts` logs every request's metadata (method/path/status/latency/IP), never bodies/PII. |
