import { Request } from 'express';

import { ProductRepository } from '../repositories/product.repository';
import { OrderRepository } from '../repositories/order.repository';
import { CheckoutDTO } from '../dtos/order.dto';
import { HttpError } from '../errors/http-error';
import { auditService } from './audit.service';
import { IOrderItem } from '../models/order.model';

const productRepository = new ProductRepository();
const orderRepository = new OrderRepository();

export class OrderService {
  /**
   * Place an order from a client-supplied list of {productId, quantity}.
   *
   * Security-relevant properties:
   *  - Server-authoritative pricing: prices/names are looked up from the DB,
   *    never taken from the client → price-tampering is impossible.
   *  - Atomic stock decrement with an availability guard → no overselling and
   *    no race condition between concurrent checkouts.
   *  - Compensation: if any later item fails, already-decremented items are
   *    restored so stock stays consistent.
   *  - Ownership: the order is tied to the authenticated user id.
   *  - Audited.
   */
  async checkout(req: Request, userId: string, dto: CheckoutDTO) {
    const items: IOrderItem[] = [];
    const decremented: Array<{ id: string; qty: number }> = [];
    let total = 0;

    try {
      for (const line of dto.items) {
        const product = await productRepository.findById(line.productId);
        if (!product) {
          throw new HttpError(404, 'One or more products no longer exist.');
        }

        const updated = await productRepository.decrementStock(
          line.productId,
          line.quantity,
        );
        if (!updated) {
          throw new HttpError(
            400,
            `Not enough stock for "${product.name}".`,
          );
        }
        decremented.push({ id: line.productId, qty: line.quantity });

        // Authoritative price snapshot from the database.
        items.push({
          productId: product._id,
          name: product.name,
          price: product.price,
          quantity: line.quantity,
        });
        total += product.price * line.quantity;
      }

      const order = await orderRepository.create({
        userId: userId as any,
        items,
        total,
        status: 'placed',
      });

      await auditService.log(req, {
        event: 'ORDER_PLACED',
        userId,
        success: true,
        detail: `order ${order._id} total ${total}`,
      });

      return order;
    } catch (err) {
      // Roll back any stock we already decremented.
      for (const d of decremented) {
        await productRepository.decrementStock(d.id, -d.qty);
      }
      await auditService.log(req, {
        event: 'ORDER_FAILED',
        userId,
        success: false,
        detail: err instanceof HttpError ? err.message : 'checkout error',
      });
      throw err;
    }
  }

  // Ownership enforced in the repository query.
  myOrders(userId: string) {
    return orderRepository.findByUser(userId);
  }
}

export const orderService = new OrderService();
