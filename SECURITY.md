# Security Policy & Risk Register — GadgetHub

## Reporting

This is an academic project. For coursework purposes, security issues are
tracked in this file and in the internal penetration-test report
(`docs/PENTEST-REPORT.md`).

## Automated checks (CI)

Every push and pull request to `main` runs:

- **Build + type-check** of backend and frontend.
- **Dependency audit** (`npm audit`) — full report always shown; the build
  hard-fails on **critical** advisories.
- **Secret scanning** (Gitleaks) over full history.
- **Static analysis** (CodeQL, `security-and-quality` query pack).

## Accepted / triaged advisories

Professional practice is to triage findings by exploitability, not to force a
breaking upgrade blindly. The following are known and accepted for this
coursework build:

| ID | Package | Severity | Decision & justification |
|----|---------|----------|--------------------------|
| GHSA-mwv6-3258-q52c (and related) | `next` 14.2.x | High | The remaining fix requires a **breaking** major upgrade to Next 16. The advisories concern self-hosted DoS via the **Image Optimizer**, **middleware/proxy** rewrites, and RSC request handling — features this app does **not** use (no `next/image` remote patterns, no custom middleware/rewrites, no untrusted RSC input). Patched within 14.x as far as non-breaking releases allow (currently 14.2.35). Tracked for a controlled framework upgrade. |
| GHSA-qx2v-qp2m-jg93 | `postcss` <8.5.10 | Moderate | Transitive, **build-time** only (not shipped to the browser at runtime). No user-controlled CSS is processed. |

Backend dependencies: **0 known vulnerabilities**.

## Secrets & key management

- `JWT_SECRET` and `ENCRYPTION_KEY` must be strong random values in production;
  the app refuses to start with default values when `NODE_ENV=production`.
- Secrets are supplied via environment / secret store, never committed. `.env`
  files are git-ignored and Gitleaks guards against accidental commits.
