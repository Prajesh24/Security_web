import { Request, Response, NextFunction } from 'express';
import { orderService } from '../services/order.service';
import { CheckoutDTO } from '../dtos/order.dto';
import { HttpError } from '../errors/http-error';

export class OrderController {
  async checkout(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new HttpError(401, 'Authentication required.');
      const parsed = CheckoutDTO.safeParse(req.body);
      if (!parsed.success) {
        throw new HttpError(400, parsed.error.issues[0]?.message ?? 'Invalid input.');
      }
      const order = await orderService.checkout(req, req.user.id, parsed.data);
      res.status(201).json({ success: true, message: 'Order placed', order });
    } catch (err) {
      next(err);
    }
  }

  async myOrders(req: Request, res: Response, next: NextFunction) {
    try {
      if (!req.user) throw new HttpError(401, 'Authentication required.');
      const orders = await orderService.myOrders(req.user.id);
      res.status(200).json({ success: true, orders });
    } catch (err) {
      next(err);
    }
  }
}

export const orderController = new OrderController();
