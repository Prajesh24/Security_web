/**
 * Lightweight, dependency-free password strength assessment used server-side to
 * reject weak choices that still technically satisfy the character-class policy
 * (e.g. "Password@1"). It complements — it does not replace — bcrypt hashing.
 */

// A short blocklist of the most abused passwords / patterns. In production this
// would be backed by the full HaveIBeenPwned k-anonymity range API.
const COMMON = new Set([
  'password', 'passw0rd', 'password1', 'password123', 'qwerty', 'qwerty123',
  'admin', 'admin123', 'letmein', 'welcome', 'welcome1', 'iloveyou',
  '12345678', '123456789', 'abc12345', 'monkey', 'dragon', 'football',
  'gadgethub', 'changeme', 'secret', 'test1234', 'p@ssw0rd',
]);

export function isCommonPassword(password: string): boolean {
  const p = password.toLowerCase();
  if (COMMON.has(p)) return true;
  // Strip a trailing punctuation+digit suffix and re-check the stem.
  const stem = p.replace(/[^a-z]+$/i, '');
  return COMMON.has(stem);
}

export interface StrengthResult {
  score: 0 | 1 | 2 | 3 | 4; // weak → strong
  label: string;
  suggestions: string[];
}

/** Estimates strength from length, character variety and common-password checks. */
export function assessStrength(password: string): StrengthResult {
  const suggestions: string[] = [];
  let score = 0;

  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;
  if (classes >= 3) score++;
  if (classes === 4 && password.length >= 10) score++;

  if (password.length < 12) suggestions.push('Use 12 or more characters.');
  if (classes < 4) suggestions.push('Mix upper, lower, digits and symbols.');
  if (isCommonPassword(password)) {
    score = 0;
    suggestions.push('Avoid common or predictable passwords.');
  }

  const clamped = Math.max(0, Math.min(4, score)) as 0 | 1 | 2 | 3 | 4;
  const label = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'][clamped];
  return { score: clamped, label, suggestions };
}
