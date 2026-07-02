'use client';

import { assessStrength } from '../lib/passwordStrength';

const COLORS = ['#dc2626', '#ea580c', '#d97706', '#16a34a', '#15803d'];

/** Live password strength bar + guidance. Purely advisory; server enforces policy. */
export default function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const { score, label, suggestions } = assessStrength(password);
  const pct = ((score + 1) / 5) * 100;

  return (
    <div style={{ marginTop: 6, marginBottom: 8 }} aria-live="polite">
      <div style={{ height: 6, background: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: COLORS[score],
            transition: 'width .2s, background .2s',
          }}
        />
      </div>
      <div style={{ fontSize: 12, marginTop: 4, color: COLORS[score] }}>
        Strength: {label}
      </div>
      {suggestions.length > 0 && (
        <ul style={{ fontSize: 11, color: '#6b7280', margin: '4px 0 0 16px' }}>
          {suggestions.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
