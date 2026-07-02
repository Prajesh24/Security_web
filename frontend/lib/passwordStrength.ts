/**
 * Client-side password strength estimation for live feedback as the user types.
 * Mirrors the server-side check in backend/utils/passwordStrength.ts — the
 * server remains the source of truth; this only guides the user.
 */
const COMMON = new Set([
  'password', 'passw0rd', 'password1', 'password123', 'qwerty', 'qwerty123',
  'admin', 'admin123', 'letmein', 'welcome', 'welcome1', 'iloveyou',
  '12345678', '123456789', 'abc12345', 'monkey', 'dragon', 'football',
  'gadgethub', 'changeme', 'secret', 'test1234', 'p@ssw0rd',
]);

export interface Strength {
  score: number; // 0..4
  label: string;
  suggestions: string[];
}

export function assessStrength(password: string): Strength {
  if (!password) return { score: 0, label: '', suggestions: [] };

  const suggestions: string[] = [];
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;
  if (classes >= 3) score++;
  if (classes === 4 && password.length >= 10) score++;

  if (password.length < 12) suggestions.push('Use 12 or more characters.');
  if (classes < 4) suggestions.push('Mix upper, lower, digits and symbols.');

  const stem = password.toLowerCase().replace(/[^a-z]+$/i, '');
  if (COMMON.has(password.toLowerCase()) || COMMON.has(stem)) {
    score = 0;
    suggestions.push('Avoid common or predictable passwords.');
  }

  const clamped = Math.max(0, Math.min(4, score));
  const label = ['Very weak', 'Weak', 'Fair', 'Strong', 'Very strong'][clamped];
  return { score: clamped, label, suggestions };
}
