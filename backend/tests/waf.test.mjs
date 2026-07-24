/**
 * WAF (application-layer firewall) integration tests.
 * Verifies that known attack signatures are blocked with a generic 403 while
 * legitimate traffic passes. Requires the API running (see security.test.mjs).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const API = process.env.API || 'http://localhost:6060';

test('WAF blocks path-traversal in the URL', async () => {
  const res = await fetch(`${API}/api/products/..%2f..%2fetc/passwd`);
  assert.equal(res.status, 403);
});

test('WAF blocks known scanner user-agents', async () => {
  const res = await fetch(`${API}/api/products`, { headers: { 'User-Agent': 'sqlmap/1.7' } });
  assert.equal(res.status, 403);
});

test('WAF blocks obvious XSS payloads in the body', async () => {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: '<script>alert(1)</script>', password: 'x' }),
  });
  assert.equal(res.status, 403);
});

test('WAF lets legitimate requests through', async () => {
  const res = await fetch(`${API}/api/products`);
  assert.equal(res.status, 200);
});
