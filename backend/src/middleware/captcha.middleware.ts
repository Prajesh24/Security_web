import { Request, Response, NextFunction } from 'express';
import { verifyCaptcha } from '../utils/captcha';
import { HttpError } from '../errors/http-error';

/**
 * Rejects the request unless it carries a valid, unexpired CAPTCHA solution
 * (`captchaToken` + `captchaAnswer` in the JSON body). Placed in front of
 * registration and login to raise the cost of automated / bot-driven abuse.
 */
export function requireCaptcha(req: Request, _res: Response, next: NextFunction): void {
  const { captchaToken, captchaAnswer } = req.body ?? {};
  if (!verifyCaptcha(captchaToken, captchaAnswer)) {
    return next(new HttpError(400, 'CAPTCHA verification failed. Please try again.'));
  }
  next();
}
