import crypto from 'crypto';
import { Request } from 'express';

import { UserRepository } from '../repositories/user.repository';
import { IUser } from '../models/user.model';
import { auditService } from './audit.service';
import { HttpError } from '../errors/http-error';
import { CLIENT_URL, IS_PROD } from '../config';

const userRepository = new UserRepository();

// Magic links are short lived to bound the window in which a leaked link works.
const MAGIC_TTL_MS = 10 * 60 * 1000;

function hash(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export class PasswordlessService {
  /**
   * Issues a single-use magic-link token for an existing account. We store only
   * the SHA-256 *hash* of the token (so a DB leak can't be replayed) and always
   * return the same generic response whether or not the email exists (no user
   * enumeration). In development the link is surfaced (log + returned) so it can
   * be demonstrated without an email provider; in production it is emailed only.
   */
  async request(req: Request, email: string): Promise<{ devLink?: string }> {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      await auditService.log(req, {
        event: 'MAGIC_REQUEST',
        email,
        success: false,
        detail: 'no such user',
      });
      return {}; // generic — do not reveal non-existence
    }

    const token = crypto.randomBytes(32).toString('hex');
    await userRepository.updateById(user._id.toString(), {
      magicTokenHash: hash(token),
      magicTokenExpires: new Date(Date.now() + MAGIC_TTL_MS),
    });

    const link = `${CLIENT_URL}/magic?token=${token}`;
    await auditService.log(req, {
      event: 'MAGIC_REQUEST',
      email: user.email,
      userId: user._id.toString(),
      success: true,
    });

    // Stand-in for an email send. Wire this to an email provider in production.
    // eslint-disable-next-line no-console
    console.log(`Magic login link for ${user.email}: ${link}`);
    return IS_PROD ? {} : { devLink: link };
  }

  /**
   * Verifies a magic token: it must match the stored hash, be unexpired, and is
   * consumed on use (single-use). Returns the authenticated user.
   */
  async verify(req: Request, token: string): Promise<IUser> {
    if (!token) throw new HttpError(400, 'Missing token.');
    const user = await userRepository.findByMagicTokenHash(hash(token));

    if (!user || !user.magicTokenExpires || user.magicTokenExpires.getTime() < Date.now()) {
      await auditService.log(req, {
        event: 'MAGIC_VERIFY',
        success: false,
        detail: 'invalid or expired token',
      });
      throw new HttpError(401, 'This login link is invalid or has expired.');
    }

    // Consume the token so it cannot be replayed.
    await userRepository.updateById(user._id.toString(), {
      magicTokenHash: null,
      magicTokenExpires: null,
      lastLoginAt: new Date(),
    });
    await auditService.log(req, {
      event: 'MAGIC_VERIFY',
      email: user.email,
      userId: user._id.toString(),
      success: true,
    });
    return user;
  }
}

export const passwordlessService = new PasswordlessService();
