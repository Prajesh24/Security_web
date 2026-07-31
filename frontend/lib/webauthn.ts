'use client';

/**
 * Thin wrapper around @simplewebauthn/browser for passkey registration and
 * login. The browser library handles the ArrayBuffer <-> base64url conversion
 * the raw navigator.credentials API requires; we just shuttle its JSON in and
 * out of our own API.
 */
import { startRegistration, startAuthentication, browserSupportsWebAuthn } from '@simplewebauthn/browser';
import { apiGet, apiPost, apiDelete } from './api';

export { browserSupportsWebAuthn };

export interface Passkey {
  credentialId: string;
  deviceName: string;
  createdAt: string;
}

export async function listPasskeys(): Promise<Passkey[]> {
  const res = await apiGet('/api/auth/webauthn/credentials');
  return res.ok ? res.data.passkeys : [];
}

export async function removePasskey(credentialId: string): Promise<boolean> {
  const res = await apiDelete(`/api/auth/webauthn/credentials/${credentialId}`);
  return res.ok;
}

/** Registers a new passkey for the signed-in user. Throws with a user-facing message on failure. */
export async function registerPasskey(deviceName: string): Promise<void> {
  const opts = await apiPost('/api/auth/webauthn/register/options');
  if (!opts.ok) throw new Error(opts.data?.message || 'Could not start passkey registration.');

  let attestation;
  try {
    attestation = await startRegistration({ optionsJSON: opts.data.options });
  } catch {
    throw new Error('Passkey registration was cancelled or not supported on this device.');
  }

  const verify = await apiPost('/api/auth/webauthn/register/verify', {
    response: attestation,
    deviceName,
  });
  if (!verify.ok) throw new Error(verify.data?.message || 'Passkey registration failed.');
}

/**
 * Attempts a passkey login for the given email. Returns 'unavailable' if the
 * account has no registered passkeys (a generic outcome — never reveals
 * whether the email itself is registered), 'cancelled' if the user backed out
 * of the browser prompt, or 'ok' with the login response on success.
 */
export async function loginWithPasskey(
  email: string,
): Promise<{ status: 'ok'; data: any } | { status: 'unavailable' | 'cancelled' | 'failed'; message?: string }> {
  const opts = await apiPost('/api/auth/webauthn/login/options', { email });
  if (!opts.ok || !opts.data?.available) {
    return { status: 'unavailable' };
  }

  let assertion;
  try {
    assertion = await startAuthentication({ optionsJSON: opts.data.options });
  } catch {
    return { status: 'cancelled' };
  }

  const verify = await apiPost('/api/auth/webauthn/login/verify', { email, response: assertion });
  if (!verify.ok) return { status: 'failed', message: verify.data?.message };
  return { status: 'ok', data: verify.data };
}
