import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/server';

import { WEBAUTHN_RP_ID, WEBAUTHN_RP_NAME, WEBAUTHN_ORIGIN } from '../config';
import { UserRepository } from '../repositories/user.repository';
import { IUser, IWebAuthnCredential } from '../models/user.model';
import { HttpError } from '../errors/http-error';

const userRepository = new UserRepository();

// Ceremonies must complete within 5 minutes; a stale challenge is rejected.
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

/**
 * WebAuthn / passkey support (FIDO2).
 *
 * This is phishing-resistant, passwordless authentication: the private key
 * never leaves the authenticator (a hardware key, or a platform authenticator
 * like Touch ID / Face ID / Windows Hello), so there is no shared secret a
 * server breach or a fake login page could steal. Each credential is scoped
 * to this exact origin by the browser itself — a cloned or look-alike domain
 * simply cannot obtain a valid signature, which is the core defence against
 * phishing that OTP/password-based MFA does not provide.
 *
 * The challenge for each in-progress ceremony is stored on the user document
 * (mirroring the existing magic-link/MFA-pending patterns in this codebase)
 * rather than in server-side session state, keeping the API stateless.
 */
export class WebAuthnService {
  /** Step 1 of registering a new passkey for an already-authenticated user. */
  async startRegistration(user: IUser) {
    const options = await generateRegistrationOptions({
      rpName: WEBAUTHN_RP_NAME,
      rpID: WEBAUTHN_RP_ID,
      userID: new TextEncoder().encode(user._id.toString()),
      userName: user.email,
      userDisplayName: user.fullName,
      attestationType: 'none', // we don't need to know the authenticator model, only that it's genuine
      // Never let a user register the same authenticator twice.
      excludeCredentials: user.webauthnCredentials.map((c) => ({
        id: c.credentialId,
        transports: c.transports as AuthenticatorTransportFuture[],
      })),
      authenticatorSelection: {
        residentKey: 'preferred', // enables usernameless/discoverable login
        userVerification: 'preferred', // prefer biometric/PIN, don't hard-require it
      },
    });

    await userRepository.updateById(user._id.toString(), {
      currentChallenge: options.challenge,
      currentChallengeExpires: new Date(Date.now() + CHALLENGE_TTL_MS),
    } as Partial<IUser>);

    return options;
  }

  /** Step 2: verify the authenticator's response and store the new credential. */
  async finishRegistration(
    user: IUser,
    response: RegistrationResponseJSON,
    deviceName: string,
  ): Promise<void> {
    const challenge = this.consumeChallenge(user);

    let verification: VerifiedRegistrationResponse;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: challenge,
        expectedOrigin: WEBAUTHN_ORIGIN,
        expectedRPID: WEBAUTHN_RP_ID,
      });
    } catch {
      throw new HttpError(400, 'Passkey registration could not be verified.');
    }
    if (!verification.verified || !verification.registrationInfo) {
      throw new HttpError(400, 'Passkey registration could not be verified.');
    }

    const { credential } = verification.registrationInfo;
    const newCredential: IWebAuthnCredential = {
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString('base64'),
      counter: credential.counter,
      transports: credential.transports ?? [],
      deviceName: deviceName.trim().slice(0, 60) || 'Passkey',
      createdAt: new Date(),
    };

    await userRepository.updateById(user._id.toString(), {
      webauthnCredentials: [...user.webauthnCredentials, newCredential],
      currentChallenge: null,
      currentChallengeExpires: null,
    } as Partial<IUser>);
  }

  /** Step 1 of logging in with a passkey, scoped to a known account by email. */
  async startAuthentication(user: IUser) {
    const options = await generateAuthenticationOptions({
      rpID: WEBAUTHN_RP_ID,
      userVerification: 'preferred',
      allowCredentials: user.webauthnCredentials.map((c) => ({
        id: c.credentialId,
        transports: c.transports as AuthenticatorTransportFuture[],
      })),
    });

    await userRepository.updateById(user._id.toString(), {
      currentChallenge: options.challenge,
      currentChallengeExpires: new Date(Date.now() + CHALLENGE_TTL_MS),
    } as Partial<IUser>);

    return options;
  }

  /** Step 2: verify the assertion signature against the stored public key. */
  async finishAuthentication(
    user: IUser,
    response: AuthenticationResponseJSON,
  ): Promise<void> {
    const challenge = this.consumeChallenge(user);

    const stored = user.webauthnCredentials.find((c) => c.credentialId === response.id);
    if (!stored) {
      throw new HttpError(401, 'Passkey not recognised for this account.');
    }

    let verification: VerifiedAuthenticationResponse;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: challenge,
        expectedOrigin: WEBAUTHN_ORIGIN,
        expectedRPID: WEBAUTHN_RP_ID,
        credential: {
          id: stored.credentialId,
          publicKey: new Uint8Array(Buffer.from(stored.publicKey, 'base64')),
          counter: stored.counter,
          transports: stored.transports as AuthenticatorTransportFuture[],
        },
      });
    } catch {
      throw new HttpError(401, 'Passkey sign-in could not be verified.');
    }
    if (!verification.verified) {
      throw new HttpError(401, 'Passkey sign-in could not be verified.');
    }

    // Persist the new signature counter — a value that fails to increase on a
    // later login is the standard signal of a cloned authenticator.
    const updated = user.webauthnCredentials.map((c) =>
      c.credentialId === stored.credentialId
        ? { ...c, counter: verification.authenticationInfo.newCounter }
        : c,
    );
    await userRepository.updateById(user._id.toString(), {
      webauthnCredentials: updated,
      currentChallenge: null,
      currentChallengeExpires: null,
    } as Partial<IUser>);
  }

  /** Minimal, safe-to-expose summary of a user's registered passkeys. */
  listCredentials(user: IUser) {
    return user.webauthnCredentials.map((c) => ({
      credentialId: c.credentialId,
      deviceName: c.deviceName,
      createdAt: c.createdAt,
    }));
  }

  async removeCredential(user: IUser, credentialId: string): Promise<void> {
    const remaining = user.webauthnCredentials.filter((c) => c.credentialId !== credentialId);
    if (remaining.length === user.webauthnCredentials.length) {
      throw new HttpError(404, 'Passkey not found.');
    }
    await userRepository.updateById(user._id.toString(), {
      webauthnCredentials: remaining,
    } as Partial<IUser>);
  }

  private consumeChallenge(user: IUser): string {
    if (
      !user.currentChallenge ||
      !user.currentChallengeExpires ||
      user.currentChallengeExpires.getTime() < Date.now()
    ) {
      throw new HttpError(400, 'Your passkey session expired. Please try again.');
    }
    return user.currentChallenge;
  }
}

export const webauthnService = new WebAuthnService();
