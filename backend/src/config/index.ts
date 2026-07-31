import dotenv from 'dotenv';

dotenv.config();

export const PORT: number = parseInt(process.env.PORT || '6060', 10);
export const NODE_ENV: string = process.env.NODE_ENV || 'development';
export const IS_PROD: boolean = NODE_ENV === 'production';
export const CLIENT_URL: string = process.env.CLIENT_URL || 'http://localhost:3000';

export const MONGODB_URI: string =
  process.env.MONGODB_URI || 'mongodb://localhost:27017/gadgethub';

export const JWT_SECRET: string =
  process.env.JWT_SECRET || 'change_me_to_a_long_random_secret_in_production';
// CW2 baseline: access token lifetime of at least 15 days.
export const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '15d';

// CW2 baseline: lock out after 10–15 failed attempts (not too aggressive).
export const MAX_LOGIN_ATTEMPTS: number = parseInt(
  process.env.MAX_LOGIN_ATTEMPTS || '10',
  10,
);
export const LOCK_MINUTES: number = parseInt(process.env.LOCK_MINUTES || '15', 10);
export const BCRYPT_ROUNDS: number = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);

// Password reuse prevention & expiry.
export const PASSWORD_HISTORY: number = parseInt(process.env.PASSWORD_HISTORY || '5', 10);
export const PASSWORD_MAX_AGE_DAYS: number = parseInt(
  process.env.PASSWORD_MAX_AGE_DAYS || '90',
  10,
);

// AES-256-GCM key material for at-rest encryption of sensitive fields.
export const ENCRYPTION_KEY: string =
  process.env.ENCRYPTION_KEY || 'dev_only_change_me_encryption_key';

// Network-level access control (deny-by-default allowlist + blocklist).
function parseIpList(raw: string | undefined): string[] {
  return (raw || '')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean);
}
export const IP_ALLOWLIST: string[] = parseIpList(process.env.IP_ALLOWLIST);
export const IP_BLOCKLIST: string[] = parseIpList(process.env.IP_BLOCKLIST);

// Browser origins permitted to call the API with credentials. Defaults to the
// configured frontend. The literal string "null" origin (file://, sandboxed
// iframes) is NEVER accepted — see the CORS setup in app.ts.
export const CORS_ALLOWLIST: string[] = (() => {
  const extra = parseIpList(process.env.CORS_ALLOWLIST);
  return Array.from(new Set([CLIENT_URL, ...extra]));
})();

// Hosts the server is allowed to make outbound HTTP(S) requests to. Used by the
// SSRF-safe fetch helper (utils/safeFetch.ts). Empty = deny all outbound calls.
export const OUTBOUND_HOST_ALLOWLIST: string[] = parseIpList(
  process.env.OUTBOUND_HOST_ALLOWLIST,
);

// ── OAuth 2.0 (Google, Authorization Code flow) ───────────────────────────────
// Configure these from the Google Cloud Console. When both client id and secret
// are present the "Continue with Google" flow is enabled; otherwise it is off
// and the rest of the app is unaffected.
export const GOOGLE_CLIENT_ID: string = process.env.GOOGLE_CLIENT_ID || '';
export const GOOGLE_CLIENT_SECRET: string = process.env.GOOGLE_CLIENT_SECRET || '';
export const GOOGLE_REDIRECT_URI: string =
  process.env.GOOGLE_REDIRECT_URI ||
  'http://localhost:6060/api/auth/oauth/google/callback';
export const OAUTH_GOOGLE_ENABLED: boolean = Boolean(
  GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET,
);

// ── WebAuthn / Passkeys (FIDO2) ───────────────────────────────────────────────
// Phishing-resistant passwordless authentication: a hardware key, Touch ID,
// Face ID, or a synced passkey. RP_ID must be the bare domain (no scheme/port)
// that the frontend is served from; the browser refuses the ceremony otherwise.
// localhost is a valid RP ID for development — WebAuthn treats it as a secure
// context without TLS.
export const WEBAUTHN_RP_ID: string = process.env.WEBAUTHN_RP_ID || 'localhost';
export const WEBAUTHN_RP_NAME: string = process.env.WEBAUTHN_RP_NAME || 'GadgetHub';
export const WEBAUTHN_ORIGIN: string = process.env.WEBAUTHN_ORIGIN || CLIENT_URL;

// Test-only escape hatch so the automated suite isn't throttled by the
// in-memory rate limiters. Never enable this in production.
export const RATE_LIMIT_DISABLED: boolean =
  process.env.RATE_LIMIT_DISABLED === 'true' && !IS_PROD;

// Fail fast in production if the JWT secret was left at its default or is too
// short to provide adequate entropy (>= 32 chars, e.g. `openssl rand -hex 32`).
if (IS_PROD && (JWT_SECRET.startsWith('change_me') || JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET must be a strong random value (>= 32 chars) in production.');
}
// Same discipline for the encryption key — a default or weak key means no real
// confidentiality for encrypted-at-rest data.
if (IS_PROD && (ENCRYPTION_KEY.includes('change_me') || ENCRYPTION_KEY.length < 32)) {
  throw new Error('ENCRYPTION_KEY must be a strong random value (>= 32 chars) in production.');
}
