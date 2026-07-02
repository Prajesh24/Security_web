# Report Outline & Rubric Map (SKELETON — write the prose yourself)

The final report is **your own work** (2000 words, CU Harvard/APA citations).
This file is only a structural skeleton + pointers to where each requirement is
evidenced in the code, so you know what to write about. Do **not** submit this
file as the report.

## Required structure (map to the brief §6)

1. **Cover page** — module, title, your name/ID, word count.
2. **Abstract** — 150 words: problem, what you built, key security outcomes.
3. **Table of contents / figures / abbreviations.**
4. **Introduction** — the user need (see README §"problem"), why it matters,
   objectives, report roadmap.
5. **Software details** — stack (Express/TS/MongoDB, Next.js), architecture
   (routes→controllers→services→repositories→models), how to run (README §4,
   docker-compose).
6. **Design and implementation** (highest-weighted — go deep):
   - System architecture + component interaction diagram (draw one).
   - **Security-by-design & threat model** — do a STRIDE or OWASP Top-10 pass;
     tie each threat to a control (table below).
   - Analysis of risks and mitigations.
   - **Code-level examples** — quote short snippets (crypto.ts, csrf.middleware.ts,
     order.service.ts pricing, profile.dto.ts strict allowlist).
   - **Map GitHub commits to security decisions** — use `git log`; each feature
     commit message explains the decision (MFA, CAPTCHA, allowlist, IP control…).
   - Emerging tech discussion (TOTP/zero-trust stepped auth, containerisation).
7. **Secure development and penetration testing** — summarise `PENTEST-REPORT.md`,
   methodology (OWASP WSTG), manual-primary + automated (npm audit/CodeQL/Gitleaks),
   CI/CD gates, 40+ commit history, incremental fixes (e.g. Next.js bump).
8. **Proof of concept** — reference the video; embed key screenshots.
9. **Conclusion** — what you achieved, limitations (README §6), future work
   (Redis-backed rate limiting/CAPTCHA, WebAuthn passwordless, replica-set ACID txns).
10. **References** — 15+ (see REFERENCES.md), CU Harvard/APA, in-text cited.

## Control → requirement → evidence map (use in the design section)

| Brief requirement | Control | Code |
|---|---|---|
| Secure registration/login | bcrypt, Zod policy, generic errors | `utils/password.ts`, `dtos/auth.dto.ts`, `services/auth.service.ts` |
| MFA | TOTP + encrypted secret + stepped login | `services/mfa.service.ts`, `utils/crypto.ts` |
| Brute-force (rate limit/lockout/CAPTCHA) | 3 layers | `middleware/rateLimit`, `services/auth.service.ts`, `utils/captcha.ts` |
| Zero-trust auth logic | password verified → separate MFA challenge token; every request re-validates JWT | `controllers/auth.controller.ts`, `middleware/auth.middleware.ts` |
| Profiles / IDOR / mass assignment / priv-esc | strict allowlist, session-scoped identity | `dtos/profile.dto.ts`, `services/user.service.ts` |
| Data export/import (privacy) | minimised export, profile-only import | `services/user.service.ts` |
| Transaction integrity | server-side pricing, atomic stock, rollback | `services/order.service.ts`, `repositories/product.repository.ts` |
| Logging/monitoring | audit events, no sensitive data | `services/audit.service.ts` |
| Password policy (len/complexity/reuse/expiry/strength) | full lifecycle | `dtos/auth.dto.ts`, `utils/passwordStrength.ts`, `services/auth.service.ts` |
| RBAC least privilege | customer vs admin guards | `middleware/rbac.middleware.ts` |
| Session management | httpOnly+SameSite+Secure, short expiry, invalidation | `controllers/auth.controller.ts`, `utils/jwt.ts` |
| Encryption & key mgmt | bcrypt + AES-256-GCM, env-derived key, prod fail-fast | `utils/crypto.ts`, `config/index.ts` |
| System-wide brute force / IP control | rate limit + IP allow/block list | `middleware/ipAccess.middleware.ts` |
| Security headers / CORS | Helmet CSP/HSTS, allowlist | `app.ts` |
| Containerisation | non-root multi-stage images, compose | `*/Dockerfile`, `docker-compose.yml` |
| CI/CD security checks | build, audit, CodeQL, Gitleaks | `.github/workflows/*` |

## Word-count discipline

2000 words is tight. Spend most of it on §6 (design/threat model/analysis) and
§7 (testing). Keep §5 concise; put full detail in appendices/`PENTEST-REPORT.md`.
