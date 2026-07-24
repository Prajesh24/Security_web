/**
 * CORS integration tests — the trusted front-end origin is allowed, but the
 * literal "null" origin (sandboxed iframes / file://) is never reflected.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const API = process.env.API || 'http://localhost:6060';
const CLIENT = process.env.CLIENT_URL || 'http://localhost:3000';

test('trusted origin is allowed', async () => {
  const res = await fetch(`${API}/api/products`, { headers: { Origin: CLIENT } });
  assert.equal(res.headers.get('access-control-allow-origin'), CLIENT);
});

test('the "null" origin is rejected (no ACAO header)', async () => {
  const res = await fetch(`${API}/api/products`, { headers: { Origin: 'null' } });
  assert.equal(res.headers.get('access-control-allow-origin'), null);
});

test('an unknown origin is rejected (no ACAO header)', async () => {
  const res = await fetch(`${API}/api/products`, { headers: { Origin: 'https://evil.example' } });
  assert.equal(res.headers.get('access-control-allow-origin'), null);
});
