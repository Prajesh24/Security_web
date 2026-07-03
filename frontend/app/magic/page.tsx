'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiPost } from '../../lib/api';

function MagicInner() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState('Verifying your sign-in link…');
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [code, setCode] = useState('');

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setStatus('No token found in this link.');
      return;
    }
    (async () => {
      const res = await apiPost('/api/auth/magic/verify', { token });
      if (res.ok && res.data?.mfaRequired) {
        setMfaToken(res.data.mfaToken);
        setStatus('');
      } else if (res.ok) {
        router.push('/account');
      } else {
        setStatus(res.data?.message || 'This link is invalid or expired.');
      }
    })();
  }, [params, router]);

  async function verifyMfa(e: React.FormEvent) {
    e.preventDefault();
    const res = await apiPost('/api/auth/mfa/verify-login', { mfaToken, code });
    if (res.ok) router.push('/account');
    else setStatus(res.data?.message || 'Invalid code.');
  }

  return (
    <div className="container">
      <div className="card card-narrow">
        <h1>Passwordless sign-in</h1>
        {mfaToken ? (
          <form onSubmit={verifyMfa}>
            <p className="muted">Enter the 6-digit code from your authenticator app.</p>
            <label htmlFor="code">Authentication code</label>
            <input
              id="code"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              autoFocus
            />
            <button className="btn-primary" type="submit">Verify</button>
          </form>
        ) : (
          <p className="muted">{status}</p>
        )}
      </div>
    </div>
  );
}

export default function MagicPage() {
  return (
    <Suspense fallback={<div className="container"><div className="card">Loading…</div></div>}>
      <MagicInner />
    </Suspense>
  );
}
