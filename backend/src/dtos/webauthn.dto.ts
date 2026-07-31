import { z } from 'zod';

/**
 * The registration/authentication response objects are produced by the
 * browser's WebAuthn API (via @simplewebauthn/browser) and are cryptographically
 * verified by @simplewebauthn/server itself — that verification is the real
 * security boundary. Here we only validate the envelope fields this API adds
 * on top (email, a human-readable device label) and require the response to
 * be a non-empty object so a malformed/missing body fails fast with a clean 400.
 */
const webauthnResponse = z.record(z.string(), z.unknown()).refine((v) => Object.keys(v).length > 0, {
  message: 'Missing WebAuthn response.',
});

export const WebAuthnRegisterVerifyDTO = z.object({
  response: webauthnResponse,
  deviceName: z.string().trim().max(60).default('Passkey'),
});
export type WebAuthnRegisterVerifyDTO = z.infer<typeof WebAuthnRegisterVerifyDTO>;

export const WebAuthnLoginOptionsDTO = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
});
export type WebAuthnLoginOptionsDTO = z.infer<typeof WebAuthnLoginOptionsDTO>;

export const WebAuthnLoginVerifyDTO = z.object({
  email: z.string().email('Invalid email address').toLowerCase().trim(),
  response: webauthnResponse,
});
export type WebAuthnLoginVerifyDTO = z.infer<typeof WebAuthnLoginVerifyDTO>;
