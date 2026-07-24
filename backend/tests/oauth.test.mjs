/**
 * OAuth 2.0 tests — the provider-discovery endpoint reports availability, and
 * when Google is not configured the flow degrades safely (redirect, no crash).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const API = process.env.API || 'http://localhost:6060';

test('provider discovery reports google availability as a boolean', async () => {
  const res = await fetch(`${API}/api/auth/providers`);
  assert.equal(res.status, 200);
  const data = await res.json();
  assert.equal(typeof data.providers.google, 'boolean');
});

test('starting the flow while unconfigured redirects instead of erroring', async () => {
  const res = await fetch(`${API}/api/auth/oauth/google`, { redirect: 'manual' });
  // A 3xx redirect back to the login page (never a 500).
  assert.ok(res.status >= 300 && res.status < 400, `expected redirect, got ${res.status}`);
  assert.ok((res.headers.get('location') || '').includes('/login'));
});
