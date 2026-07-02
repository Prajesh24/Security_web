'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiPost } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await apiPost('/api/auth/login', { email, password });
    setLoading(false);
    if (res.ok) {
      const next = new URLSearchParams(window.location.search).get('next') || '/';
      router.push(next);
    } else {
      // Server returns a single generic message for all failures.
      setError(res.data?.message || 'Login failed.');
    }
  }

  return (
    <div className="container">
      <div className="card card-narrow">
        <h1>Sign in</h1>
        <p className="muted">Welcome back to SecureBank.</p>
        <form onSubmit={onSubmit}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <div className="alert alert-error">{error}</div>}
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
        <p className="muted" style={{ marginTop: 16 }}>
          New here? <a href="/register">Create an account</a>
        </p>
        <p className="muted" style={{ marginTop: 8, fontSize: 12 }}>
          Shopper demo: alice@gadgethub.test / Alice@123
          <br />
          Admin demo: admin@gadgethub.test / Admin@123
        </p>
      </div>
    </div>
  );
}
