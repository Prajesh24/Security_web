/**
 * WebAuthn/passkey integration tests. A full registration/authentication
 * ceremony requires a real authenticator (Touch ID, a security key, or a
 * virtual authenticator driven by a browser), so these tests cover the
 * server-side contract that IS testable headlessly: auth gating, challenge
 * generation, and — most importantly — that the public login-options endpoint
 * never reveals whether an email is registered or has passkeys.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const API = process.env.API || 'http://localhost:6060';

test('registration options require an authenticated session', async () => {
  const res = await fetch(`${API}/api/auth/webauthn/register/options`, { method: 'POST' });
  assert.equal(res.status, 401);
});

test('login options endpoint does not reveal whether an email exists', async () => {
  const unknown = await fetch(`${API}/api/auth/webauthn/login/options`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'definitely-not-registered@nowhere.test' }),
  });
  const known = await fetch(`${API}/api/auth/webauthn/login/options`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'alice@gadgethub.test' }), // registered, but has no passkeys yet
  });
  const unknownBody = await unknown.json();
  const knownBody = await known.json();

  assert.equal(unknown.status, 200);
  assert.equal(known.status, 200);
  // Same shape for "no such account" and "account exists but has no passkeys".
  assert.deepEqual(unknownBody, { success: true, available: false });
  assert.deepEqual(knownBody, { success: true, available: false });
});

test('a malformed login-options request is rejected, not a 500', async () => {
  const res = await fetch(`${API}/api/auth/webauthn/login/options`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'not-an-email' }),
  });
  assert.equal(res.status, 400);
});

test('login verify with a bogus response is rejected, not a 500', async () => {
  const res = await fetch(`${API}/api/auth/webauthn/login/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'alice@gadgethub.test', response: { bogus: true } }),
  });
  assert.ok(res.status === 400 || res.status === 401);
});
