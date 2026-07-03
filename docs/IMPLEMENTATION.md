# Implementation Status — Requirement by Requirement

Maps every ST6005CEM CW2 brief requirement to its status, the code that
implements it, and how it was verified. Legend: ✅ done · ⚠️ partial/your input
needed · ⬚ your own work (report/video).

## 1. Web Application Overview
| Requirement | Status | Evidence |
|---|---|---|
| Problem / user need defined | ✅ | `README.md`, `docs/REPORT-OUTLINE.md` §4 |
| Justification & user benefit | ✅ | README; expand in report |
| Uniqueness of concept | ⚠️ | Argue further in report §4 |
| Emerging tech / sustainability | ✅ | TOTP, stepped/zero-trust auth, containerisation |

## 2. Core Functional Features
| Requirement | Status | Code | Verified by |
|---|---|---|---|
| Intuitive UI / navigation / roles | ✅ | `frontend/app/*` | Manual |
| Accessibility approach + findings | ✅ | `frontend/app/layout.tsx`, `globals.css`, `docs/ACCESSIBILITY.md` | Lighthouse/axe/keyboard |
| Secure registration & login | ✅ | `services/auth.service.ts`, `dtos/auth.dto.ts` | `tests/security.test.mjs` |
| Multi-Factor Authentication | ✅ | `services/mfa.service.ts`, `controllers/mfa.controller.ts` | `scratchpad/mfa_test.mjs` |
| Brute-force: rate limit + lockout + CAPTCHA | ✅ | `middleware/rateLimit`, `services/auth.service.ts`, `utils/captcha.ts` | `captcha_test.mjs`, tests |
| Zero-trust custom auth logic | ✅ | password→separate MFA challenge; per-request JWT re-validation | `auth.middleware.ts` |
| Customizable profiles | ✅ | `dtos/profile.dto.ts`, `services/user.service.ts` | `profile_test.mjs`, tests |
| IDOR / mass-assignment / priv-esc protection | ✅ | strict allowlist; session-scoped id; no `/users/:id` | tests, fuzzer |
| Secure profile data handling | ✅ | `models/user.model.ts` toJSON strips secrets | Manual |
| Data export/import (privacy) | ✅ | `services/user.service.ts` | `export_test.mjs` |
| Secure transaction processing | ✅ | `services/order.service.ts` (server-side pricing, atomic stock, rollback) | Manual |
| Supply-chain risk (3rd-party APIs) | ✅ | `SECURITY.md`; no external payment API (justified) | — |
| Activity logging & monitoring | ✅ | `services/audit.service.ts` | Admin audit log |
| Real-time monitoring / alerting | ✅ | `services/monitoring.service.ts`, `GET /api/admin/alerts` | `monitor_test.mjs` |

## 3. Security Features
| Requirement | Status | Code | Verified by |
|---|---|---|---|
| Password length/complexity | ✅ | `dtos/auth.dto.ts` | tests |
| Password reuse prevention | ✅ | `services/auth.service.ts` (history) | `pw_test.mjs` |
| Password expiry | ✅ | `isPasswordExpired`, `passwordChangedAt` | Manual |
| Password strength feedback | ✅ | `utils/passwordStrength.ts`, `components/PasswordStrength.tsx` | Manual |
| Password-less authentication (advanced) | ✅ | `services/passwordless.service.ts`, `/magic` | `magic_test.mjs` |
| System-wide brute force (rate limit/throttle) | ✅ | `middleware/rateLimit.middleware.ts` | Manual |
| IP blocking / allow-listing | ✅ | `middleware/ipAccess.middleware.ts` | Manual |
| Consistent across auth + sensitive endpoints | ✅ | routes wiring | Manual |
| RBAC least privilege | ✅ | `middleware/rbac.middleware.ts` | Manual |
| Secure session (cookie attrs/expiry/invalidation) | ✅ | `controllers/auth.controller.ts`, `utils/jwt.ts` | Manual |
| Session binding to device/UA | ✅ | UA fingerprint in JWT (`uab`) | `session_test.mjs`, tests |
| Encryption + key management | ✅ | `utils/crypto.ts` (AES-256-GCM), `utils/password.ts` (bcrypt), `config` fail-fast | Manual |
| Security headers / CORS | ✅ | `app.ts` (Helmet CSP/HSTS, CORS allowlist) | `curl -I` |

## 4. Secure Development & Internal Pentest
| Requirement | Status | Evidence |
|---|---|---|
| Source on GitHub | ⚠️ | Git initialised locally — **push to GitHub** |
| 40+ meaningful commits | ⚠️ | 19 so far — keep committing (tests/docs/fixes) |
| Incremental security improvements | ✅ | one commit per control; Next.js CVE bump; F-09 fix |
| Vulnerability fixes in history | ✅ | `fix(api): map body-parser errors…` (F-09) |
| Containerization | ✅ | `*/Dockerfile`, `docker-compose.yml` (⚠️ build on a Docker host) |
| CI/CD with security checks | ✅ | `.github/workflows/ci.yml`, `codeql.yml` (build, tests, fuzz, audit, CodeQL, Gitleaks) |
| Pentest: scope/assumptions/ethics | ✅ | `docs/PENTEST-REPORT.md` §1 |
| Recognised methodology (OWASP) | ✅ | WSTG + Top 10 |
| Manual testing primary | ✅ | scripts + browser |
| Automated tools supplementary | ✅ | audit, CodeQL, Gitleaks, fuzzer |
| White-box review + targeted fuzzing | ✅ | `scripts/fuzz.mjs`, `docs/FUZZING.md` |
| Coverage (authn/authz/logic/input/session/client/API) | ✅ | `docs/PENTEST-REPORT.md` §3 |
| Vulns documented (name/category/CVSS/path/evidence/remediation/retest) | ✅ | `docs/PENTEST-REPORT.md` (CVSS vectors scored) |

## 5. Proof of Concept Video
| Requirement | Status |
|---|---|
| Compulsory video, face + audio, captions | ⬚ Your own recording |
| Two vulnerabilities before/after | ⬚ Use F-01/F-02 or F-09 (toggle control on a branch) |

## 6–7. Report & References
| Requirement | Status | Evidence |
|---|---|---|
| Formal report structure (12 sections) | ⬚ | Skeleton in `docs/REPORT-OUTLINE.md` |
| 2000 words, CU Harvard/APA citations | ⬚ | Your own writing |
| 15+ references | ⚠️ | 20 starters in `docs/REFERENCES.md` (verify & cite) |

## 8–9. Evidence Quality & Enforcement
| Requirement | Status | Evidence |
|---|---|---|
| Clear, repeatable evidence | ✅ | Deterministic scripts + `npm test` (repeatable) |
| Secure dev / academic integrity compliance | ✅ | Own code; AI use acknowledged per policy; no secrets committed (Gitleaks) |

## How to verify everything quickly
```bash
# backend running with limiter disabled for a clean run:
cd backend && RATE_LIMIT_DISABLED=true npm run dev   # terminal 1
cd backend && npm test && npm run fuzz               # terminal 2
```
