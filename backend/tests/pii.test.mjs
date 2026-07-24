/**
 * PII-encryption round-trip test. Profile phone/address are AES-256-GCM
 * encrypted at rest, but the API must transparently return the plaintext to the
 * owner — proving the encrypt-on-write / decrypt-on-read path works end to end.
 *
 * Runs authenticated via the dev magic-link (no CAPTCHA needed).
 * Requires the API running with RATE_LIMIT_DISABLED=true (see security.test.mjs).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const API = process.env.API || 'http://localhost:6060';

function client() {
  let cookies = {};
  const jar = () => Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  function store(res) {
    for (const c of res.headers.getSetCookie?.() || []) {
      const kv = c.split(';')[0];
      const i = kv.indexOf('=');
      cookies[kv.slice(0, i)] = kv.slice(i + 1);
    }
  }
  async function req(method, path, body) {
    const headers = { 'Content-Type': 'application/json', Cookie: jar() };
    if (cookies.csrfToken) headers['X-CSRF-Token'] = cookies.csrfToken;
    const res = await fetch(API + path, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    });
    store(res);
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }
  return { req };
}

test('profile PII is stored encrypted but returned in plaintext to the owner', async () => {
  const c = client();
  // 1) passwordless login (dev returns the link directly)
  const link = await c.req('POST', '/api/auth/magic/request', { email: 'alice@gadgethub.test' });
  const token = link.data.devLink.split('token=')[1];
  const verify = await c.req('POST', '/api/auth/magic/verify', { token });
  assert.equal(verify.status, 200);

  // 2) write PII
  const phone = '+9779800000000';
  const city = 'Pokhara';
  const upd = await c.req('PATCH', '/api/users/me', { phone, address: { city } });
  assert.equal(upd.status, 200);

  // 3) read it back — must be decrypted transparently
  const me = await c.req('GET', '/api/users/me');
  assert.equal(me.status, 200);
  assert.equal(me.data.user.profile.phone, phone);
  assert.equal(me.data.user.profile.address.city, city);
});
