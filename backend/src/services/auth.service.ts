import { Request } from 'express';

import { UserRepository } from '../repositories/user.repository';
import { RegisterDTO, LoginDTO, ChangePasswordDTO } from '../dtos/auth.dto';
import { hashPassword, verifyPassword } from '../utils/password';
import { HttpError } from '../errors/http-error';
import { auditService } from './audit.service';
import {
  MAX_LOGIN_ATTEMPTS,
  LOCK_MINUTES,
  PASSWORD_HISTORY,
  PASSWORD_MAX_AGE_DAYS,
} from '../config';
import { IUser } from '../models/user.model';

const userRepository = new UserRepository();

/** True if the password is older than the configured maximum age. */
export function isPasswordExpired(user: IUser): boolean {
  if (!user.passwordChangedAt) return false;
  const ageMs = Date.now() - new Date(user.passwordChangedAt).getTime();
  return ageMs > PASSWORD_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}

// Same message for "no such user" and "wrong password" → prevents attackers
// from enumerating which emails are registered.
const GENERIC_LOGIN_ERROR = 'Invalid email or password.';

export class AuthService {
  async register(req: Request, dto: RegisterDTO): Promise<IUser> {
    const existing = await userRepository.findByEmail(dto.email);
    if (existing) {
      // Don't reveal that the email exists during *registration* either —
      // return a neutral conflict.
      await auditService.log(req, {
        event: 'REGISTER',
        email: dto.email,
        success: false,
        detail: 'email already registered',
      });
      throw new HttpError(409, 'Could not create account with those details.');
    }

    const hashed = await hashPassword(dto.password);
    const user = await userRepository.create({
      fullName: dto.fullName,
      email: dto.email,
      password: hashed,
      role: 'customer',
      passwordChangedAt: new Date(),
      passwordHistory: [hashed], // seed reuse-prevention history
    });

    await auditService.log(req, {
      event: 'REGISTER',
      email: user.email,
      userId: user._id.toString(),
      success: true,
    });

    return user;
  }

  async login(req: Request, dto: LoginDTO): Promise<IUser> {
    const user = await userRepository.findByEmail(dto.email);

    if (!user) {
      await auditService.log(req, {
        event: 'LOGIN',
        email: dto.email,
        success: false,
        detail: 'no such user',
      });
      throw new HttpError(401, GENERIC_LOGIN_ERROR);
    }

    // ── Account lockout check ────────────────────────────────────────────
    if (user.lockUntil && user.lockUntil.getTime() > Date.now()) {
      await auditService.log(req, {
        event: 'LOGIN_BLOCKED',
        email: user.email,
        userId: user._id.toString(),
        success: false,
        detail: 'account temporarily locked',
      });
      throw new HttpError(
        429,
        'Account temporarily locked due to too many failed attempts. Try again later.',
      );
    }

    // OAuth-only accounts have no password hash — never allow password login
    // against them (and never call bcrypt with an undefined hash).
    if (!user.password) {
      await auditService.log(req, {
        event: 'LOGIN',
        email: user.email,
        userId: user._id.toString(),
        success: false,
        detail: 'password login attempted on federated account',
      });
      throw new HttpError(401, GENERIC_LOGIN_ERROR);
    }

    const ok = await verifyPassword(dto.password, user.password);
    if (!ok) {
      const attempts = user.failedLoginAttempts + 1;
      const update: Partial<IUser> = { failedLoginAttempts: attempts };
      let locked = false;
      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        update.lockUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
        update.failedLoginAttempts = 0; // reset counter once locked
        locked = true;
      }
      await userRepository.updateById(user._id.toString(), update);
      await auditService.log(req, {
        event: locked ? 'ACCOUNT_LOCKED' : 'LOGIN',
        email: user.email,
        userId: user._id.toString(),
        success: false,
        detail: locked ? 'locked after repeated failures' : `wrong password (attempt ${attempts})`,
      });
      throw new HttpError(401, GENERIC_LOGIN_ERROR);
    }

    // ── Success: reset lockout counters ──────────────────────────────────
    await userRepository.updateById(user._id.toString(), {
      failedLoginAttempts: 0,
      lockUntil: null,
      lastLoginAt: new Date(),
    });
    await auditService.log(req, {
      event: 'LOGIN',
      email: user.email,
      userId: user._id.toString(),
      success: true,
    });

    return user;
  }

  /**
   * Changes a user's password with full lifecycle protection:
   *  - the current password must be proven (re-authentication),
   *  - the new password must not match any of the last N (reuse prevention),
   *  - the old hash is pushed onto a capped history and the change is timestamped.
   */
  async changePassword(req: Request, userId: string, dto: ChangePasswordDTO): Promise<void> {
    const user = await userRepository.findById(userId);
    if (!user) throw new HttpError(404, 'User not found.');
    if (!user.password) {
      // Federated (OAuth) account — there is no local password to change.
      throw new HttpError(400, 'Password changes are not available for this account.');
    }

    if (!(await verifyPassword(dto.currentPassword, user.password))) {
      await auditService.log(req, {
        event: 'PASSWORD_CHANGE',
        email: user.email,
        userId,
        success: false,
        detail: 'wrong current password',
      });
      throw new HttpError(400, 'Current password is incorrect.');
    }

    // Reuse prevention: compare the new password against the current hash and
    // every remembered historical hash.
    const history = [user.password, ...(user.passwordHistory ?? [])];
    for (const oldHash of history) {
      if (await verifyPassword(dto.newPassword, oldHash)) {
        throw new HttpError(400, `Do not reuse any of your last ${PASSWORD_HISTORY} passwords.`);
      }
    }

    const newHash = await hashPassword(dto.newPassword);
    const trimmedHistory = [user.password, ...(user.passwordHistory ?? [])].slice(
      0,
      PASSWORD_HISTORY,
    );
    await userRepository.updateById(userId, {
      password: newHash,
      passwordChangedAt: new Date(),
      passwordHistory: trimmedHistory,
    });

    await auditService.log(req, {
      event: 'PASSWORD_CHANGE',
      email: user.email,
      userId,
      success: true,
    });
  }
}

export const authService = new AuthService();
