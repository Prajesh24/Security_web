import { JwtPayload } from '../utils/jwt';

declare global {
  namespace Express {
    interface Request {
      // Populated by authMiddleware after verifying the JWT.
      user?: JwtPayload;
    }
  }
}

export {};
