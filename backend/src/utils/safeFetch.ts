import { lookup } from 'dns/promises';
import net from 'net';
import { OUTBOUND_HOST_ALLOWLIST } from '../config';

/**
 * SSRF-safe outbound HTTP client.
 *
 * Server-Side Request Forgery happens when an attacker can make the server
 * fetch a URL of their choosing — typically to reach internal-only services
 * (cloud metadata endpoints, databases, admin panels) from a trusted network
 * position. The defences here, in order:
 *
 *   1. Protocol allowlist — only http/https.
 *   2. Host allowlist — the target host MUST be explicitly configured in
 *      OUTBOUND_HOST_ALLOWLIST (deny-by-default; empty list = no outbound).
 *   3. DNS-resolution guard — resolve the host and refuse any address in a
 *      private, loopback, link-local, or otherwise non-public range. This
 *      defeats DNS-rebinding and hostnames that point at 127.0.0.1 / 169.254.x.
 *   4. No automatic redirects — a 3xx to an internal host would bypass the
 *      checks above, so redirects are not followed.
 *
 * There is currently no user-controlled outbound request in the app; this
 * helper exists so that ANY future outbound call (webhooks, avatar imports,
 * link previews) is SSRF-safe by construction.
 */

function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // loopback
    if (a === 0) return true; // "this" network
    if (a === 169 && b === 254) return true; // link-local / cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
    return false;
  }
  const lower = ip.toLowerCase();
  // IPv6 loopback, unspecified, unique-local (fc00::/7) and link-local (fe80::/10).
  return (
    lower === '::1' ||
    lower === '::' ||
    lower.startsWith('fc') ||
    lower.startsWith('fd') ||
    lower.startsWith('fe8') ||
    lower.startsWith('fe9') ||
    lower.startsWith('fea') ||
    lower.startsWith('feb')
  );
}

export async function assertUrlIsSafe(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL.');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http and https URLs are permitted.');
  }

  if (!OUTBOUND_HOST_ALLOWLIST.includes(url.hostname)) {
    throw new Error(`Host "${url.hostname}" is not on the outbound allowlist.`);
  }

  // Resolve every address the host maps to and reject if ANY is internal.
  const literal = net.isIP(url.hostname)
    ? [{ address: url.hostname }]
    : await lookup(url.hostname, { all: true });
  for (const { address } of literal) {
    if (isPrivateAddress(address)) {
      throw new Error('Refusing to connect to a private/internal address (SSRF).');
    }
  }

  return url;
}

export async function safeFetch(
  rawUrl: string,
  init: RequestInit = {},
): Promise<Response> {
  await assertUrlIsSafe(rawUrl);
  return fetch(rawUrl, {
    ...init,
    redirect: 'error', // never auto-follow into an unchecked host
    signal: init.signal ?? AbortSignal.timeout(5000),
  });
}
