'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiPost } from '../../lib/api';
import Captcha from '../../components/Captcha';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // CAPTCHA challenge state.
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaReload, setCaptchaReload] = useState(0);
  const onCaptcha = useCallback((t: string, a: string) => {
    setCaptchaToken(t);
    setCaptchaAnswer(a);
  }, []);

  // MFA challenge state — set once the server asks for a second factor.
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [code, setCode] = useState('');

  function redirect() {
    const next = new URLSearchParams(window.location.search).get('next') || '/';
    router.push(next);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await apiPost('/api/auth/login', {
      email,
      password,
      captchaToken,
      captchaAnswer,
    });
    setLoading(false);
    if (res.ok && res.data?.mfaRequired) {
      // Password accepted — now require the authenticator code.
      setMfaToken(res.data.mfaToken);
    } else if (res.ok) {
      redirect();
    } else {
      // Server returns a single generic message for all failures.
      setError(res.data?.message || 'Login failed.');
      setCaptchaReload((n) => n + 1); // one-time challenge → refresh it
    }
  }

  async function onVerify(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const res = await apiPost('/api/auth/mfa/verify-login', { mfaToken, code });
    setLoading(false);
    if (res.ok) {
      redirect();
    } else {
      setError(res.data?.message || 'Invalid code.');
    }
  }

  if (mfaToken) {
    return (
      <div className="container">
        <div className="card card-narrow">
          <h1>Two-factor verification</h1>
          <p className="muted">Enter the 6-digit code from your authenticator app.</p>
          <form onSubmit={onVerify}>
            <label htmlFor="code">Authentication code</label>
            <input
              id="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="\d{6}"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              autoFocus
              required
            />
            {error && <div className="alert alert-error">{error}</div>}
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? 'Verifying…' : 'Verify'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="card card-narrow">
        <h1>Sign in</h1>
        <p className="muted">Welcome back to GadgetHub.</p>
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
          <Captcha onChange={onCaptcha} reloadSignal={captchaReload} />
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
