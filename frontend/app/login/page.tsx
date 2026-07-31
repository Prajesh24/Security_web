'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost } from '../../lib/api';
import Captcha from '../../components/Captcha';
import { loginWithPasskey, browserSupportsWebAuthn } from '../../lib/webauthn';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:6060';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Federated login (OAuth 2.0). Only show the button if the server has it
  // configured, and surface any error the callback redirected back with.
  const [googleEnabled, setGoogleEnabled] = useState(false);
  useEffect(() => {
    apiGet('/api/auth/providers').then((res) => {
      setGoogleEnabled(!!res.data?.providers?.google);
    });
    const err = new URLSearchParams(window.location.search).get('error');
    if (err === 'oauth') setError('Google sign-in failed. Please try again.');
    else if (err === 'oauth_unavailable') setError('Google sign-in is not configured on this server.');
  }, []);

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

  // Passwordless (magic-link) state.
  const [magicMode, setMagicMode] = useState(false);
  const [magicMsg, setMagicMsg] = useState('');

  // Passkey (WebAuthn) login state.
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  useEffect(() => {
    setPasskeySupported(browserSupportsWebAuthn());
  }, []);

  async function onPasskeyLogin() {
    if (!email) {
      setError('Enter your email above, then choose "Sign in with a passkey".');
      return;
    }
    setError('');
    setPasskeyLoading(true);
    const result = await loginWithPasskey(email);
    setPasskeyLoading(false);
    if (result.status === 'ok') {
      redirect();
    } else if (result.status === 'unavailable') {
      setError('No passkey is registered for this email. Sign in another way, or add one from Account after signing in.');
    } else if (result.status === 'cancelled') {
      // User backed out of the OS/browser prompt — no error needed.
    } else {
      setError(result.message || 'Passkey sign-in failed.');
    }
  }

  async function requestMagic(e: React.FormEvent) {
    e.preventDefault();
    setMagicMsg('');
    const res = await apiPost('/api/auth/magic/request', { email });
    // Generic message regardless of whether the email exists (no enumeration).
    setMagicMsg(res.data?.message || 'Check your email for a sign-in link.');
    // Dev convenience: the API returns a link in non-production so it is testable.
    if (res.data?.devLink) setMagicMsg(`Dev link: ${res.data.devLink}`);
  }

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
            {error && <div className="alert alert-error" role="alert">{error}</div>}
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
          {error && <div className="alert alert-error" role="alert">{error}</div>}
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        {passkeySupported && (
          <div style={{ marginTop: 16 }}>
            <button
              type="button"
              className="btn-outline"
              style={{ width: '100%' }}
              onClick={onPasskeyLogin}
              disabled={passkeyLoading}
            >
              {passkeyLoading ? 'Waiting for passkey…' : '🔐 Sign in with a passkey'}
            </button>
          </div>
        )}

        {googleEnabled && (
          <div style={{ marginTop: 16 }}>
            {/* Full-page navigation to the backend, which redirects to Google. */}
            <a className="btn-outline" style={{ display: 'block', textAlign: 'center' }} href={`${API_URL}/api/auth/oauth/google`}>
              Continue with Google
            </a>
          </div>
        )}

        <div style={{ marginTop: 16, borderTop: '1px solid #e5e7eb', paddingTop: 12 }}>
          {!magicMode ? (
            <button type="button" className="btn-outline btn-sm" onClick={() => setMagicMode(true)}>
              Email me a sign-in link (passwordless)
            </button>
          ) : (
            <form onSubmit={requestMagic}>
              <label htmlFor="magic-email">Send a one-time sign-in link to</label>
              <input
                id="magic-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
              <button className="btn-outline btn-sm" type="submit">Send link</button>
            </form>
          )}
          {magicMsg && <div className="alert alert-success" style={{ wordBreak: 'break-all' }}>{magicMsg}</div>}
        </div>

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
