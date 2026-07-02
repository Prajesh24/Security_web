import { Request, Response, NextFunction } from 'express';
import { auditService } from '../services/audit.service';
import { UserRepository } from '../repositories/user.repository';
import { OrderRepository } from '../repositories/order.repository';

const userRepository = new UserRepository();
const orderRepository = new OrderRepository();

/** Admin-only endpoints. Protected by authMiddleware + requireRole('admin'). */
export class AdminController {
  async auditLogs(_req: Request, res: Response, next: NextFunction) {
    try {
      const logs = await auditService.recent(100);
      res.status(200).json({ success: true, logs });
    } catch (err) {
      next(err);
    }
  }

  async users(_req: Request, res: Response, next: NextFunction) {
    try {
      const users = await userRepository.findAll();
      res.status(200).json({ success: true, users });
    } catch (err) {
      next(err);
    }
  }

  async orders(_req: Request, res: Response, next: NextFunction) {
    try {
      const orders = await orderRepository.findAll();
      res.status(200).json({ success: true, orders });
    } catch (err) {
      next(err);
    }
  }
}

export const adminController = new AdminController();
