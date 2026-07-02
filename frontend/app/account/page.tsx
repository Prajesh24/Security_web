'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiGet, apiPost, apiPatch } from '../../lib/api';
import PasswordStrength from '../../components/PasswordStrength';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:6060';

interface Profile {
  displayName: string;
  bio: string;
  phone: string;
  address: { line1: string; city: string; postcode: string; country: string };
  preferences: { currency: string; marketingEmails: boolean };
}
interface Me {
  email: string;
  fullName: string;
  role: string;
  mfaEnabled: boolean;
  profile: Profile;
}

export default function AccountPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function refresh() {
    const res = await apiGet('/api/users/me');
    if (res.status === 401) {
      router.push('/login?next=/account');
      return;
    }
    if (res.ok) setMe(res.data.user);
  }
  useEffect(() => {
    refresh();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function flash(setter: (v: string) => void, text: string) {
    setter(text);
    setTimeout(() => setter(''), 4000);
  }

  if (!me) {
    return (
      <div className="container">
        <div className="card">Loading…</div>
      </div>
    );
  }

  return (
    <div className="container">
      <h1>My Account</h1>
      <p className="muted">
        Signed in as {me.email} ({me.role})
      </p>
      {msg && <div className="alert alert-success">{msg}</div>}
      {err && <div className="alert alert-error">{err}</div>}

      <ProfileCard me={me} onSaved={(t) => { flash(setMsg, t); refresh(); }} onError={(t) => flash(setErr, t)} />
      <MfaCard me={me} onChanged={(t) => { flash(setMsg, t); refresh(); }} onError={(t) => flash(setErr, t)} />
      <PasswordCard onDone={(t) => flash(setMsg, t)} onError={(t) => flash(setErr, t)} />
      <DataCard onDone={(t) => { flash(setMsg, t); refresh(); }} onError={(t) => flash(setErr, t)} />
    </div>
  );
}

/* ── Profile ──────────────────────────────────────────────────────────────── */
function ProfileCard({ me, onSaved, onError }: { me: Me; onSaved: (t: string) => void; onError: (t: string) => void }) {
  const p = me.profile;
  const [displayName, setDisplayName] = useState(p.displayName || '');
  const [bio, setBio] = useState(p.bio || '');
  const [phone, setPhone] = useState(p.phone || '');
  const [city, setCity] = useState(p.address?.city || '');
  const [currency, setCurrency] = useState(p.preferences?.currency || 'NPR');
  const [marketingEmails, setMarketingEmails] = useState(!!p.preferences?.marketingEmails);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const res = await apiPatch('/api/users/me', {
      displayName,
      bio,
      phone,
      address: { city },
      preferences: { currency, marketingEmails },
    });
    if (res.ok) onSaved('Profile saved.');
    else onError(res.data?.message || 'Could not save profile.');
  }

  return (
    <div className="card">
      <h2>Profile</h2>
      <form onSubmit={save}>
        <label htmlFor="dn">Display name</label>
        <input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
        <label htmlFor="bio">Bio</label>
        <input id="bio" value={bio} onChange={(e) => setBio(e.target.value)} />
        <label htmlFor="phone">Phone</label>
        <input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <label htmlFor="city">City</label>
        <input id="city" value={city} onChange={(e) => setCity(e.target.value)} />
        <label htmlFor="cur">Preferred currency</label>
        <select id="cur" value={currency} onChange={(e) => setCurrency(e.target.value)}>
          {['NPR', 'USD', 'EUR', 'GBP'].map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
          <input type="checkbox" checked={marketingEmails} onChange={(e) => setMarketingEmails(e.target.checked)} />
          Receive marketing emails
        </label>
        <button className="btn-primary" type="submit">Save profile</button>
      </form>
    </div>
  );
}

/* ── MFA ──────────────────────────────────────────────────────────────────── */
function MfaCard({ me, onChanged, onError }: { me: Me; onChanged: (t: string) => void; onError: (t: string) => void }) {
  const [qr, setQr] = useState('');
  const [code, setCode] = useState('');

  async function startSetup() {
    const res = await apiPost('/api/auth/mfa/setup');
    if (res.ok) setQr(res.data.qrDataUrl);
    else onError(res.data?.message || 'Could not start MFA setup.');
  }
  async function enable(e: React.FormEvent) {
    e.preventDefault();
    const res = await apiPost('/api/auth/mfa/enable', { code });
    if (res.ok) { setQr(''); setCode(''); onChanged('MFA enabled.'); }
    else onError(res.data?.message || 'Invalid code.');
  }
  async function disable(e: React.FormEvent) {
    e.preventDefault();
    const res = await apiPost('/api/auth/mfa/disable', { code });
    if (res.ok) { setCode(''); onChanged('MFA disabled.'); }
    else onError(res.data?.message || 'Invalid code.');
  }

  return (
    <div className="card">
      <h2>Two-factor authentication</h2>
      <p className="muted">Status: {me.mfaEnabled ? '✅ Enabled' : '❌ Disabled'}</p>

      {!me.mfaEnabled && !qr && (
        <button className="btn-outline btn-sm" onClick={startSetup}>Set up authenticator app</button>
      )}

      {!me.mfaEnabled && qr && (
        <form onSubmit={enable}>
          <p className="muted">Scan this with Google Authenticator / Authy, then enter the code.</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="MFA QR code" width={180} height={180} />
          <label htmlFor="mc">6-digit code</label>
          <input id="mc" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
          <button className="btn-primary" type="submit">Enable MFA</button>
        </form>
      )}

      {me.mfaEnabled && (
        <form onSubmit={disable}>
          <label htmlFor="dc">Enter a current code to disable</label>
          <input id="dc" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
          <button className="btn-danger btn-sm" type="submit">Disable MFA</button>
        </form>
      )}
    </div>
  );
}

/* ── Password ─────────────────────────────────────────────────────────────── */
function PasswordCard({ onDone, onError }: { onDone: (t: string) => void; onError: (t: string) => void }) {
  const [currentPassword, setCurrent] = useState('');
  const [newPassword, setNew] = useState('');

  async function change(e: React.FormEvent) {
    e.preventDefault();
    const res = await apiPost('/api/users/me/password', { currentPassword, newPassword });
    if (res.ok) { setCurrent(''); setNew(''); onDone('Password changed.'); }
    else onError(res.data?.message || 'Could not change password.');
  }

  return (
    <div className="card">
      <h2>Change password</h2>
      <form onSubmit={change}>
        <label htmlFor="cp">Current password</label>
        <input id="cp" type="password" value={currentPassword} onChange={(e) => setCurrent(e.target.value)} required />
        <label htmlFor="np">New password</label>
        <input id="np" type="password" value={newPassword} onChange={(e) => setNew(e.target.value)} required />
        <PasswordStrength password={newPassword} />
        <button className="btn-primary" type="submit">Update password</button>
      </form>
    </div>
  );
}

/* ── Data export / import ─────────────────────────────────────────────────── */
function DataCard({ onDone, onError }: { onDone: (t: string) => void; onError: (t: string) => void }) {
  async function importFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const res = await apiPost('/api/users/me/import', { profile: parsed.profile });
      if (res.ok) onDone('Profile imported from file.');
      else onError(res.data?.message || 'Import failed.');
    } catch {
      onError('That file is not valid JSON.');
    } finally {
      e.target.value = '';
    }
  }

  return (
    <div className="card">
      <h2>Your data (privacy)</h2>
      <p className="muted">Download a copy of your data, or re-import a profile from an export.</p>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        {/* Export is a GET the browser downloads directly (Content-Disposition). */}
        <a className="btn-outline btn-sm" href={`${API_URL}/api/users/me/export`}>Download my data</a>
        <label className="btn-outline btn-sm" style={{ cursor: 'pointer' }}>
          Import profile…
          <input type="file" accept="application/json" onChange={importFile} style={{ display: 'none' }} />
        </label>
      </div>
    </div>
  );
}
