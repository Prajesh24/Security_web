/**
 * Client-side card handling for the (simulated) payment step.
 *
 * Security note: the raw card number, expiry and CVC are validated and
 * consumed ENTIRELY in the browser. They are never sent to the GadgetHub
 * API — only the opaque token produced by `tokenize()` below, plus the
 * brand/last4 needed for a receipt, ever leave this module. That keeps the
 * backend out of PCI-DSS card-data scope, the same architectural pattern a
 * real integration (Stripe Elements, PayPal, etc.) uses: their JS SDK
 * tokenizes in the browser and the server only ever sees a token.
 *
 * GadgetHub has no real payment processor — the backend's paymentService
 * simulates authorization instead of calling one. A handful of Stripe-style
 * test numbers are recognised below so declines can be demonstrated; any
 * other Luhn-valid number is treated as approved.
 */

export interface CardInput {
  number: string;
  expiry: string; // MM/YY
  cvc: string;
  name: string;
}

export interface CardValidationError {
  field: 'number' | 'expiry' | 'cvc' | 'name';
  message: string;
}

const TEST_DECLINE_GENERIC = '4000000000000002';
const TEST_DECLINE_INSUFFICIENT_FUNDS = '4000000000009995';

function luhnValid(digits: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i], 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function detectBrand(digits: string): string {
  if (/^4/.test(digits)) return 'Visa';
  if (/^5[1-5]/.test(digits)) return 'Mastercard';
  if (/^3[47]/.test(digits)) return 'Amex';
  if (/^6(?:011|5)/.test(digits)) return 'Discover';
  return 'Card';
}

/** Validates card fields locally. Returns [] if the card looks chargeable. */
export function validateCard(input: CardInput): CardValidationError[] {
  const errors: CardValidationError[] = [];
  const digits = input.number.replace(/\s+/g, '');

  if (!/^\d{13,19}$/.test(digits) || !luhnValid(digits)) {
    errors.push({ field: 'number', message: 'Enter a valid card number.' });
  }

  const m = input.expiry.match(/^(\d{2})\s*\/\s*(\d{2})$/);
  if (!m) {
    errors.push({ field: 'expiry', message: 'Use MM/YY.' });
  } else {
    const month = parseInt(m[1], 10);
    const year = 2000 + parseInt(m[2], 10);
    const now = new Date();
    const expiresEndOfMonth = new Date(year, month, 1);
    if (month < 1 || month > 12 || expiresEndOfMonth <= now) {
      errors.push({ field: 'expiry', message: 'Card has expired.' });
    }
  }

  if (!/^\d{3,4}$/.test(input.cvc)) {
    errors.push({ field: 'cvc', message: 'Enter a valid CVC.' });
  }

  if (!input.name.trim()) {
    errors.push({ field: 'name', message: 'Enter the name on the card.' });
  }

  return errors;
}

/**
 * Turns a validated card into an opaque token to send to the server. The
 * full number/expiry/CVC are discarded immediately after this call — only
 * the brand, last 4 digits, and the simulated outcome are encoded.
 */
export function tokenize(input: CardInput): string {
  const digits = input.number.replace(/\s+/g, '');
  const brand = detectBrand(digits);
  const last4 = digits.slice(-4);

  let outcome: 'approved' | 'declined_generic' | 'declined_insufficient_funds' = 'approved';
  if (digits === TEST_DECLINE_GENERIC) outcome = 'declined_generic';
  else if (digits === TEST_DECLINE_INSUFFICIENT_FUNDS) outcome = 'declined_insufficient_funds';

  const payload = { v: 1, brand, last4, outcome };
  const json = JSON.stringify(payload);
  // base64url encode (browser-safe, matches backend's decoder)
  const b64 = btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return b64;
}

export function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  // Fallback UUIDv4 for older browsers.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
