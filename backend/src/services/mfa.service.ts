import { generateSecret, generateURI, verify } from 'otplib';
import QRCode from 'qrcode';

import { UserRepository } from '../repositories/user.repository';
import { IUser } from '../models/user.model';
import { HttpError } from '../errors/http-error';
import { encrypt, decrypt } from '../utils/crypto';

const userRepository = new UserRepository();

const ISSUER = 'GadgetHub';
// Accept codes within ±30s (one time-step) to tolerate clock drift between the
// server and the user's authenticator app without widening the window further.
const EPOCH_TOLERANCE = 30;

async function isValidCode(secret: string, token: string): Promise<boolean> {
  const result = await verify({ secret, token, epochTolerance: EPOCH_TOLERANCE });
  return result.valid;
}

export interface MfaSetup {
  otpauthUrl: string;
  qrDataUrl: string;
}

export class MfaService {
  /**
   * Begin enrolment: generate a fresh TOTP secret, store it *encrypted* as a
   * pending secret (not yet active), and return provisioning data for the
   * authenticator app. MFA is only switched on once the user proves possession
   * by confirming a code (see `enable`).
   */
  async setup(user: IUser): Promise<MfaSetup> {
    const secret = generateSecret(); // base32
    await userRepository.updateById(user._id.toString(), {
      mfaPendingSecret: encrypt(secret),
    });
    const otpauthUrl = generateURI({ issuer: ISSUER, label: user.email, secret });
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);
    return { otpauthUrl, qrDataUrl };
  }

  /** Confirm enrolment: the code must validate against the pending secret. */
  async enable(user: IUser, token: string): Promise<void> {
    if (!user.mfaPendingSecret) {
      throw new HttpError(400, 'Start MFA setup first.');
    }
    const secret = decrypt(user.mfaPendingSecret);
    if (!(await isValidCode(secret, token))) {
      throw new HttpError(400, 'Invalid authentication code.');
    }
    await userRepository.updateById(user._id.toString(), {
      mfaEnabled: true,
      mfaSecret: encrypt(secret),
      mfaPendingSecret: null,
    });
  }

  /** Turn MFA off — requires a currently-valid code (step-up authorization). */
  async disable(user: IUser, token: string): Promise<void> {
    if (!user.mfaEnabled || !user.mfaSecret) {
      throw new HttpError(400, 'MFA is not enabled.');
    }
    if (!(await this.verifyCode(user, token))) {
      throw new HttpError(400, 'Invalid authentication code.');
    }
    await userRepository.updateById(user._id.toString(), {
      mfaEnabled: false,
      mfaSecret: null,
      mfaPendingSecret: null,
    });
  }

  /** Verify a login-time TOTP code against the user's active secret. */
  async verifyCode(user: IUser, token: string): Promise<boolean> {
    if (!user.mfaEnabled || !user.mfaSecret) return false;
    const secret = decrypt(user.mfaSecret);
    return isValidCode(secret, token);
  }
}

export const mfaService = new MfaService();
