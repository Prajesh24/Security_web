import { Request, Response, NextFunction } from 'express';

import { webauthnService } from '../services/webauthn.service';
import { isPasswordExpired } from '../services/auth.service';
import { auditService } from '../services/audit.service';
import { UserRepository } from '../repositories/user.repository';
import {
  WebAuthnRegisterVerifyDTO,
  WebAuthnLoginOptionsDTO,
  WebAuthnLoginVerifyDTO,
} from '../dtos/webauthn.dto';
import { HttpError } from '../errors/http-error';
import { signToken, fingerprintUserAgent } from '../utils/jwt';
import { issueCsrfToken } from '../middleware/csrf.middleware';
import { IS_PROD } from '../config';
import type { RegistrationResponseJSON, AuthenticationResponseJSON } from '@simplewebauthn/server';

const userRepository = new UserRepository();
const TOKEN_COOKIE = 'token';

/**
 * Passkey (WebAuthn/FIDO2) endpoints.
 *
 * Registration is authenticated — a signed-in user adds a passkey to their
 * own account (mirrors the MFA setup flow). Login is public but scoped by
 * email, matching this app's other credential-entry routes; the challenge
 * for each ceremony lives on the user document with a 5-minute expiry (see
 * webauthn.service.ts), so no server-side session store is required.
 */
export class WebAuthnController {
  // ── Registration (adds a passkey to the signed-in account) ─────────────────
  async registerOptions(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await userRepository.findById(req.user!.id);
      if (!user) throw new HttpError(404, 'User not found.');
      const options = await webauthnService.startRegistration(user);
      res.json({ success: true, options });
    } catch (err) {
      next(err);
    }
  }

  async registerVerify(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = WebAuthnRegisterVerifyDTO.safeParse(req.body);
      if (!parsed.success) {
        throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid request.');
      }
      const user = await userRepository.findById(req.user!.id);
      if (!user) throw new HttpError(404, 'User not found.');

      await webauthnService.finishRegistration(
        user,
        parsed.data.response as unknown as RegistrationResponseJSON,
        parsed.data.deviceName,
      );
      await auditService.log(req, {
        event: 'PASSKEY_REGISTERED',
        email: user.email,
        userId: user._id.toString(),
        success: true,
        detail: parsed.data.deviceName,
      });
      res.json({ success: true, message: 'Passkey added.' });
    } catch (err) {
      next(err);
    }
  }

  async listCredentials(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await userRepository.findById(req.user!.id);
      if (!user) throw new HttpError(404, 'User not found.');
      res.json({ success: true, passkeys: webauthnService.listCredentials(user) });
    } catch (err) {
      next(err);
    }
  }

  async removeCredential(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await userRepository.findById(req.user!.id);
      if (!user) throw new HttpError(404, 'User not found.');
      await webauthnService.removeCredential(user, req.params.credentialId);
      await auditService.log(req, {
        event: 'PASSKEY_REMOVED',
        email: user.email,
        userId: user._id.toString(),
        success: true,
      });
      res.json({ success: true, message: 'Passkey removed.' });
    } catch (err) {
      next(err);
    }
  }

  // ── Login (public, scoped by email) ─────────────────────────────────────────
  async loginOptions(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = WebAuthnLoginOptionsDTO.safeParse(req.body);
      if (!parsed.success) throw new HttpError(400, 'A valid email is required.');

      const user = await userRepository.findByEmail(parsed.data.email);
      // No account, or no passkeys on it: return a generic "no passkeys
      // available" shape rather than a 404, so this endpoint cannot be used
      // to enumerate registered emails.
      if (!user || user.webauthnCredentials.length === 0) {
        return res.json({ success: true, available: false });
      }

      const options = await webauthnService.startAuthentication(user);
      res.json({ success: true, available: true, options });
    } catch (err) {
      next(err);
    }
  }

  async loginVerify(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = WebAuthnLoginVerifyDTO.safeParse(req.body);
      if (!parsed.success) throw new HttpError(400, 'Invalid request.');

      const user = await userRepository.findByEmail(parsed.data.email);
      if (!user) throw new HttpError(401, 'Passkey sign-in failed.');

      await webauthnService.finishAuthentication(
        user,
        parsed.data.response as unknown as AuthenticationResponseJSON,
      );

      // A verified passkey assertion is itself strong, phishing-resistant
      // authentication (possession of the authenticator + user verification),
      // so it satisfies this app's MFA requirement on its own — no further
      // TOTP step-up is required.
      const token = signToken({
        id: user._id.toString(),
        role: user.role,
        uab: fingerprintUserAgent(req.headers['user-agent'] as string | undefined),
      });
      res.cookie(TOKEN_COOKIE, token, {
        httpOnly: true,
        secure: IS_PROD,
        sameSite: 'strict',
        path: '/',
        maxAge: 15 * 24 * 60 * 60 * 1000,
      });
      issueCsrfToken(req, res);

      await auditService.log(req, {
        event: 'LOGIN',
        email: user.email,
        userId: user._id.toString(),
        success: true,
        detail: 'passkey',
      });
      res.json({
        success: true,
        message: 'Login successful',
        user,
        passwordExpired: isPasswordExpired(user),
      });
    } catch (err) {
      next(err);
    }
  }
}

export const webauthnController = new WebAuthnController();
