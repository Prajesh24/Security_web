import crypto from 'crypto';
import { JWT_SECRET } from '../config';

/**
 * A self-hosted, stateless CAPTCHA used as a brute-force / bot-signup control.
 *
 * Rather than depend on a third-party service (which adds a supply-chain risk
 * and shares user IPs with an external party), we generate a simple arithmetic
 * challenge and bind the answer to an HMAC-signed, time-limited token.
 *
 * Statelessness: the (hashed) answer travels inside the signed token, so no
 * server-side session store is needed. The client never sees the answer — it
 * only sees the rendered question — and cannot forge a token because it does
 * not hold the signing key.
 *
 *   token = base64url(payload) + '.' + HMAC-SHA256(payload)
 *   payload = { a: <answer>, exp: <expiry ms>, n: <nonce> }
 */
const CAPTCHA_TTL_MS = 2 * 60 * 1000; // 2 minutes
// Derive a dedicated key so the CAPTCHA MAC is not the raw JWT secret.
const captchaKey = crypto.createHash('sha256').update(`captcha:${JWT_SECRET}`).digest();

function sign(payloadB64: string): string {
  return crypto.createHmac('sha256', captchaKey).update(payloadB64).digest('hex');
}

export interface Captcha {
  captchaToken: string;
  svg: string;
}

export function generateCaptcha(): Captcha {
  const x = crypto.randomInt(1, 10);
  const y = crypto.randomInt(1, 10);
  const answer = x + y;

  const payload = { a: answer, exp: Date.now() + CAPTCHA_TTL_MS, n: crypto.randomBytes(6).toString('hex') };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const captchaToken = `${payloadB64}.${sign(payloadB64)}`;

  return { captchaToken, svg: renderSvg(`${x} + ${y} = ?`) };
}

export function verifyCaptcha(token: string | undefined, answer: string | undefined): boolean {
  if (!token || answer == null) return false;
  const [payloadB64, sig] = token.split('.');
  if (!payloadB64 || !sig) return false;

  // Constant-time signature check (integrity — rejects tampered tokens).
  const expected = sign(payloadB64);
  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  ) {
    return false;
  }

  let payload: { a: number; exp: number };
  try {
    payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
  } catch {
    return false;
  }
  if (Date.now() > payload.exp) return false; // expired
  return Number(String(answer).trim()) === payload.a;
}

/** Render the challenge as a mildly noised SVG so it isn't trivially scraped. */
function renderSvg(text: string): string {
  const lines = Array.from({ length: 4 }, () => {
    const x1 = crypto.randomInt(0, 200);
    const y1 = crypto.randomInt(0, 60);
    const x2 = crypto.randomInt(0, 200);
    const y2 = crypto.randomInt(0, 60);
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#cbd5e1" stroke-width="1"/>`;
  }).join('');
  const dy = crypto.randomInt(-4, 4);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="60" role="img" aria-label="arithmetic challenge">
    <rect width="200" height="60" fill="#f1f5f9"/>
    ${lines}
    <text x="100" y="${38 + dy}" font-size="28" font-family="monospace" font-weight="bold"
      fill="#1e293b" text-anchor="middle" letter-spacing="3">${text}</text>
  </svg>`;
}
