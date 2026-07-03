import { Request, Response, NextFunction } from 'express';

import { authService, isPasswordExpired } from '../services/auth.service';
import { mfaService } from '../services/mfa.service';
import { passwordlessService } from '../services/passwordless.service';
import { auditService } from '../services/audit.service';
import {
  RegisterDTO,
  LoginDTO,
  MfaLoginDTO,
  MagicRequestDTO,
  MagicVerifyDTO,
} from '../dtos/auth.dto';
import {
  signToken,
  signMfaChallenge,
  verifyMfaChallenge,
  fingerprintUserAgent,
} from '../utils/jwt';
import { issueCsrfToken } from '../middleware/csrf.middleware';
import { generateCaptcha } from '../utils/captcha';
import { HttpError } from '../errors/http-error';
import { IS_PROD } from '../config';
import { IUser } from '../models/user.model';
import { UserRepository } from '../repositories/user.repository';

const userRepository = new UserRepository();
const TOKEN_COOKIE = 'token';

// httpOnly: JS can't read it (XSS-resistant). secure: HTTPS-only in prod.
// sameSite=strict: the cookie is not sent on cross-site requests (CSRF defense).
function setAuthCookie(req: Request, res: Response, user: IUser): void {
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
    maxAge: 15 * 60 * 1000, // matches JWT_EXPIRES_IN
  });
}

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = RegisterDTO.safeParse(req.body);
      if (!parsed.success) {
        throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid input.');
      }
      const user = await authService.register(req, parsed.data);
      setAuthCookie(req, res, user);
      issueCsrfToken(req, res);
      res.status(201).json({ success: true, message: 'Account created', user });
    } catch (err) {
      next(err);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = LoginDTO.safeParse(req.body);
      if (!parsed.success) {
        throw new HttpError(400, 'Invalid email or password.');
      }
      const user = await authService.login(req, parsed.data);

      // Second factor: if MFA is enabled, do NOT establish a session yet.
      // Issue a short-lived, single-purpose challenge token the client must
      // exchange together with a valid TOTP code.
      if (user.mfaEnabled) {
        await auditService.log(req, {
          event: 'MFA_CHALLENGE',
          email: user.email,
          userId: user._id.toString(),
          success: true,
          detail: 'password ok, awaiting TOTP',
        });
        return res.status(200).json({
          success: true,
          mfaRequired: true,
          mfaToken: signMfaChallenge(user._id.toString()),
          message: 'Enter the code from your authenticator app.',
        });
      }

      setAuthCookie(req, res, user);
      issueCsrfToken(req, res);
      res.status(200).json({
        success: true,
        message: 'Login successful',
        user,
        passwordExpired: isPasswordExpired(user),
      });
    } catch (err) {
      next(err);
    }
  }

  /** Second step of MFA login: exchange challenge token + TOTP code for a session. */
  async verifyMfaLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = MfaLoginDTO.safeParse(req.body);
      if (!parsed.success) {
        throw new HttpError(400, 'A 6-digit code is required.');
      }
      let userId: string;
      try {
        userId = verifyMfaChallenge(parsed.data.mfaToken).id;
      } catch {
        throw new HttpError(401, 'Your verification session expired. Please sign in again.');
      }

      const user = await userRepository.findById(userId);
      if (!user || !user.mfaEnabled) {
        throw new HttpError(401, 'Invalid verification session.');
      }
      if (!(await mfaService.verifyCode(user, parsed.data.code))) {
        await auditService.log(req, {
          event: 'MFA_VERIFY',
          email: user.email,
          userId: user._id.toString(),
          success: false,
          detail: 'wrong TOTP code',
        });
        throw new HttpError(401, 'Invalid authentication code.');
      }

      await auditService.log(req, {
        event: 'MFA_VERIFY',
        email: user.email,
        userId: user._id.toString(),
        success: true,
      });
      setAuthCookie(req, res, user);
      issueCsrfToken(req, res);
      res.status(200).json({ success: true, message: 'Login successful', user });
    } catch (err) {
      next(err);
    }
  }

  // ── Passwordless (magic-link) login ────────────────────────────────────────
  /** Step 1: request a one-time login link (generic response — no enumeration). */
  async magicRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = MagicRequestDTO.safeParse(req.body);
      if (!parsed.success) throw new HttpError(400, 'A valid email is required.');
      const { devLink } = await passwordlessService.request(req, parsed.data.email);
      res.status(200).json({
        success: true,
        message: 'If that email is registered, a sign-in link has been sent.',
        ...(devLink ? { devLink } : {}), // dev convenience only; omitted in prod
      });
    } catch (err) {
      next(err);
    }
  }

  /** Step 2: consume the token and establish a session (MFA still applies). */
  async magicVerify(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = MagicVerifyDTO.safeParse(req.body);
      if (!parsed.success) throw new HttpError(400, 'Invalid token.');
      const user = await passwordlessService.verify(req, parsed.data.token);

      if (user.mfaEnabled) {
        return res.status(200).json({
          success: true,
          mfaRequired: true,
          mfaToken: signMfaChallenge(user._id.toString()),
          message: 'Enter the code from your authenticator app.',
        });
      }

      setAuthCookie(req, res, user);
      issueCsrfToken(req, res);
      res.status(200).json({ success: true, message: 'Login successful', user });
    } catch (err) {
      next(err);
    }
  }

  async logout(_req: Request, res: Response) {
    res.clearCookie(TOKEN_COOKIE, { path: '/' });
    res.clearCookie('csrfToken', { path: '/' });
    res.status(200).json({ success: true, message: 'Logged out' });
  }

  // Returns the current session's CSRF token; the SPA calls this on load.
  async csrf(req: Request, res: Response) {
    const token = issueCsrfToken(req, res);
    res.status(200).json({ success: true, csrfToken: token });
  }

  // Issues a fresh CAPTCHA challenge (question rendered as SVG + signed token).
  async captcha(_req: Request, res: Response) {
    const { captchaToken, svg } = generateCaptcha();
    res.status(200).json({ success: true, captchaToken, svg });
  }
}

export const authController = new AuthController();
