import { Request, Response, NextFunction } from 'express';

import { authService } from '../services/auth.service';
import { RegisterDTO, LoginDTO } from '../dtos/auth.dto';
import { signToken } from '../utils/jwt';
import { issueCsrfToken } from '../middleware/csrf.middleware';
import { HttpError } from '../errors/http-error';
import { IS_PROD } from '../config';
import { IUser } from '../models/user.model';

const TOKEN_COOKIE = 'token';

// httpOnly: JS can't read it (XSS-resistant). secure: HTTPS-only in prod.
// sameSite=strict: the cookie is not sent on cross-site requests (CSRF defense).
function setAuthCookie(res: Response, user: IUser): void {
  const token = signToken({ id: user._id.toString(), role: user.role });
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
      setAuthCookie(res, user);
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
      setAuthCookie(res, user);
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
}

export const authController = new AuthController();
