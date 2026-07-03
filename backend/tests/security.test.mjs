/**
 * Integration security tests (Node's built-in test runner — no extra deps).
 *
 * Prerequisites: MongoDB up, DB seeded, and the API running with
 * RATE_LIMIT_DISABLED=true so the suite isn't throttled:
 *
 *   RATE_LIMIT_DISABLED=true npm run dev        # (terminal 1)
 *   npm test                                    # (terminal 2)
 *
 * CI performs these steps automatically (see .github/workflows/ci.yml).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const API = process.env.API || 'http://localhost:6060';

// ── tiny cookie-aware client ────────────────────────────────────────────────
function makeClient(ua = 'TestAgent') {
  let cookies = {};
  const ch = () => Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  function store(res) {
    for (const c of res.headers.getSetCookie?.() || []) {
      const [kv] = c.split(';');
      const i = kv.indexOf('=');
      cookies[kv.slice(0, i)] = kv.slice(i + 1);
    }
  }
  async function req(method, path, body) {
    const headers = { 'Content-Type': 'application/json', Cookie: ch(), 'User-Agent': ua };
    if (cookies.csrfToken) headers['X-CSRF-Token'] = cookies.csrfToken;
    const res = await fetch(API + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    store(res);
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }
  async function solveCaptcha() {
    const r = await req('GET', '/api/auth/captcha');
    const m = r.data.svg.match(/(\d+) \+ (\d+)/);
    return { captchaToken: r.data.captchaToken, captchaAnswer: String(+m[1] + +m[2]) };
  }
  async function login(email, password) {
    const cap = await solveCaptcha();
    const r = await req('POST', '/api/auth/login', { email, password, ...cap });
    await req('GET', '/api/auth/csrf');
    return r;
  }
  return { req, solveCaptcha, login, get cookies() { return cookies; }, set cookies(v) { cookies = v; } };
}

test('health endpoint responds', async () => {
  const c = makeClient();
  const r = await c.req('GET', '/api/health');
  assert.equal(r.status, 200);
  assert.equal(r.data.success, true);
});

test('login requires a CAPTCHA', async () => {
  const c = makeClient();
  const r = await c.req('POST', '/api/auth/login', {
    email: 'alice@gadgethub.test',
    password: 'Alice@123',
  });
  assert.equal(r.status, 400); // missing captcha
});

test('NoSQL operator injection cannot bypass login', async () => {
  const c = makeClient();
  const cap = await c.solveCaptcha();
  const r = await c.req('POST', '/api/auth/login', {
    email: { $gt: '' },
    password: { $gt: '' },
    ...cap,
  });
  assert.ok(r.status === 400 || r.status === 401);
  assert.ok(!r.data.user);
});

test('registration rejects a common password', async () => {
  const c = makeClient();
  const cap = await c.solveCaptcha();
  const r = await c.req('POST', '/api/auth/register', {
    fullName: 'Common Pw',
    email: `common_${Date.now()}@test.local`,
    password: 'Password@123',
    ...cap,
  });
  assert.equal(r.status, 400);
});

test('protected route requires authentication (no IDOR surface)', async () => {
  const c = makeClient();
  const r = await c.req('GET', '/api/users/me');
  assert.equal(r.status, 401);
});

test('profile update blocks privilege escalation (mass assignment)', async () => {
  const c = makeClient();
  await c.login('alice@gadgethub.test', 'Alice@123');
  const attack = await c.req('PATCH', '/api/users/me', { role: 'admin' });
  assert.equal(attack.status, 400);
  const me = await c.req('GET', '/api/users/me');
  assert.equal(me.data.user.role, 'customer');
});

test('session is bound to the User-Agent (replay blocked)', async () => {
  const c = makeClient('BrowserA');
  await c.login('alice@gadgethub.test', 'Alice@123');
  const ok = await c.req('GET', '/api/users/me');
  assert.equal(ok.status, 200);

  // Replay the same cookies from a different UA.
  const replay = makeClient('BrowserB');
  replay.cookies = { ...c.cookies };
  const r = await replay.req('GET', '/api/users/me');
  assert.equal(r.status, 401);
});

test('oversized payload is rejected with 413, not 500', async () => {
  const c = makeClient();
  await c.login('alice@gadgethub.test', 'Alice@123');
  const r = await c.req('PATCH', '/api/users/me', { bio: 'A'.repeat(100000) });
  assert.equal(r.status, 413);
});

test('magic-link token is single-use', async () => {
  const c = makeClient('MagicAgent');
  const reqLink = await c.req('POST', '/api/auth/magic/request', {
    email: 'alice@gadgethub.test',
  });
  const token = reqLink.data.devLink?.split('token=')[1];
  assert.ok(token, 'dev link should be present in non-production');
  const first = await c.req('POST', '/api/auth/magic/verify', { token });
  assert.equal(first.status, 200);
  const second = await c.req('POST', '/api/auth/magic/verify', { token });
  assert.equal(second.status, 401); // consumed
});
