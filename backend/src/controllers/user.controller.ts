import { Request, Response, NextFunction } from 'express';

import { userService } from '../services/user.service';
import { auditService } from '../services/audit.service';
import { UpdateProfileDTO, ProfileImportDTO } from '../dtos/profile.dto';
import { HttpError } from '../errors/http-error';

/**
 * All handlers operate on the *authenticated* user (req.user.id from the
 * verified JWT). There is deliberately no `/users/:id` route, so a caller can
 * never read or mutate another user's record — this closes IDOR / broken
 * object-level authorization by construction.
 */
export class UserController {
  async me(req: Request, res: Response, next: NextFunction) {
    try {
      const user = await userService.getById(req.user!.id);
      if (!user) throw new HttpError(404, 'User not found.');
      res.json({ success: true, user });
    } catch (err) {
      next(err);
    }
  }

  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = UpdateProfileDTO.safeParse(req.body);
      if (!parsed.success) {
        // Unknown keys (e.g. an attempted `role` injection) land here too.
        throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid profile data.');
      }
      const user = await userService.updateProfile(req.user!.id, parsed.data);
      await auditService.log(req, {
        event: 'PROFILE_UPDATE',
        email: user.email,
        userId: user._id.toString(),
        success: true,
        detail: Object.keys(parsed.data).join(','),
      });
      res.json({ success: true, message: 'Profile updated', user });
    } catch (err) {
      next(err);
    }
  }

  async exportData(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await userService.exportData(req.user!.id);
      await auditService.log(req, {
        event: 'DATA_EXPORT',
        userId: req.user!.id,
        success: true,
      });
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="gadgethub-my-data.json"');
      res.status(200).send(JSON.stringify(data, null, 2));
    } catch (err) {
      next(err);
    }
  }

  async importData(req: Request, res: Response, next: NextFunction) {
    try {
      const parsed = ProfileImportDTO.safeParse(req.body);
      if (!parsed.success) {
        throw new HttpError(400, 'Invalid or unsupported data file.');
      }
      const user = await userService.importData(req.user!.id, parsed.data);
      await auditService.log(req, {
        event: 'DATA_IMPORT',
        email: user.email,
        userId: user._id.toString(),
        success: true,
      });
      res.json({ success: true, message: 'Profile imported', user });
    } catch (err) {
      next(err);
    }
  }
}

export const userController = new UserController();
