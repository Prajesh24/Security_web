import { Request } from 'express';

import { UserRepository } from '../repositories/user.repository';
import { RegisterDTO, LoginDTO } from '../dtos/auth.dto';
import { hashPassword, verifyPassword } from '../utils/password';
import { HttpError } from '../errors/http-error';
import { auditService } from './audit.service';
import { MAX_LOGIN_ATTEMPTS, LOCK_MINUTES } from '../config';
import { IUser } from '../models/user.model';

const userRepository = new UserRepository();

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
}

export const authService = new AuthService();
