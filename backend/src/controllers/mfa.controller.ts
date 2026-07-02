import { Request, Response, NextFunction } from 'express';

import { mfaService } from '../services/mfa.service';
import { auditService } from '../services/audit.service';
import { UserRepository } from '../repositories/user.repository';
import { MfaCodeDTO } from '../dtos/auth.dto';
import { HttpError } from '../errors/http-error';

const userRepository = new UserRepository();

/**
 * MFA management endpoints. All require an authenticated session (mounted
 * behind authMiddleware). We reload the full user document from the id in the
 * verified JWT rather than trusting any client-supplied identity.
 */
export class MfaController {
  async setup(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await userRepository.findById(req.user!.id);
      if (!user) throw new HttpError(404, 'User not found.');
      if (user.mfaEnabled) throw new HttpError(400, 'MFA is already enabled.');
      const { otpauthUrl, qrDataUrl } = await mfaService.setup(user);
      res.json({ success: true, otpauthUrl, qrDataUrl });
    } catch (err) {
      next(err);
    }
  }

  async enable(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = MfaCodeDTO.safeParse(req.body);
      if (!parsed.success) throw new HttpError(400, 'Enter the 6-digit code.');
      const user = await userRepository.findById(req.user!.id);
      if (!user) throw new HttpError(404, 'User not found.');
      await mfaService.enable(user, parsed.data.code);
      await auditService.log(req, {
        event: 'MFA_ENABLED',
        email: user.email,
        userId: user._id.toString(),
        success: true,
      });
      res.json({ success: true, message: 'Multi-factor authentication enabled.' });
    } catch (err) {
      next(err);
    }
  }

  async disable(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = MfaCodeDTO.safeParse(req.body);
      if (!parsed.success) throw new HttpError(400, 'Enter the 6-digit code.');
      const user = await userRepository.findById(req.user!.id);
      if (!user) throw new HttpError(404, 'User not found.');
      await mfaService.disable(user, parsed.data.code);
      await auditService.log(req, {
        event: 'MFA_DISABLED',
        email: user.email,
        userId: user._id.toString(),
        success: true,
      });
      res.json({ success: true, message: 'Multi-factor authentication disabled.' });
    } catch (err) {
      next(err);
    }
  }
}

export const mfaController = new MfaController();
