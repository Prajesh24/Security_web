/**
 * Security-header tests — Helmet must set a strict CSP, HSTS, anti-clickjacking
 * and nosniff headers, and the Express signature must be hidden.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const API = process.env.API || 'http://localhost:6060';

test('security headers are present on responses', async () => {
  const res = await fetch(`${API}/api/health`);
  assert.ok(res.headers.get('content-security-policy'), 'CSP missing');
  assert.ok(res.headers.get('strict-transport-security'), 'HSTS missing');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(res.headers.get('x-frame-options'), 'X-Frame-Options missing');
});

test('the X-Powered-By signature is removed', async () => {
  const res = await fetch(`${API}/api/health`);
  assert.equal(res.headers.get('x-powered-by'), null);
});
