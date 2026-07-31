import { Request } from 'express';

import { ProductRepository } from '../repositories/product.repository';
import { OrderRepository } from '../repositories/order.repository';
import { PaymentRepository } from '../repositories/payment.repository';
import { CheckoutDTO } from '../dtos/order.dto';
import { HttpError } from '../errors/http-error';
import { auditService } from './audit.service';
import { paymentService } from './payment.service';
import { IOrderItem } from '../models/order.model';

const productRepository = new ProductRepository();
const orderRepository = new OrderRepository();
const paymentRepository = new PaymentRepository();

export class OrderService {
  /**
   * Place an order from a client-supplied list of {productId, quantity} plus
   * a tokenized payment.
   *
   * Security-relevant properties:
   *  - Server-authoritative pricing: prices/names are looked up from the DB,
   *    never taken from the client → price-tampering is impossible.
   *  - Atomic stock decrement with an availability guard → no overselling and
   *    no race condition between concurrent checkouts.
   *  - The card is charged for the server-computed total, never a
   *    client-supplied amount, and only after stock is confirmed reserved.
   *  - Idempotent: replaying the same idempotencyKey (e.g. a retried request
   *    after a network blip) never charges the card twice.
   *  - Compensation: if payment is declined or any later step fails,
   *    already-decremented stock is restored.
   *  - Ownership: the order is tied to the authenticated user id.
   *  - Audited (payment tokens/card numbers are never logged).
   */
  async checkout(req: Request, userId: string, dto: CheckoutDTO) {
    const priorAttempt = await paymentRepository.findByIdempotencyKey(
      dto.payment.idempotencyKey,
    );
    if (priorAttempt) {
      if (priorAttempt.status === 'approved' && priorAttempt.orderId) {
        const order = await orderRepository.findById(priorAttempt.orderId.toString());
        if (order) return order;
      }
      throw new HttpError(409, 'This payment attempt was already processed.');
    }

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

      // Charge the server-computed total — never a client-supplied amount —
      // only now that stock is confirmed reserved.
      const chargeResult = paymentService.charge({
        token: dto.payment.token,
        amount: total,
        currency: 'npr',
      });

      const payment = await paymentRepository.create({
        userId: userId as any,
        amount: total,
        currency: 'npr',
        status: chargeResult.success ? 'approved' : 'declined',
        cardBrand: chargeResult.cardBrand,
        cardLast4: chargeResult.cardLast4,
        gatewayTransactionId: chargeResult.transactionId,
        declineReason: chargeResult.declineReason,
        idempotencyKey: dto.payment.idempotencyKey,
      });

      if (!chargeResult.success) {
        await auditService.log(req, {
          event: 'PAYMENT_DECLINED',
          userId,
          success: false,
          detail: `amount ${total} reason ${chargeResult.declineReason}`,
        });
        throw new HttpError(402, 'Payment declined. Please try a different card.');
      }

      const order = await orderRepository.create({
        userId: userId as any,
        items,
        total,
        status: 'placed',
        payment: {
          paymentId: payment._id,
          cardBrand: payment.cardBrand,
          cardLast4: payment.cardLast4,
          transactionId: payment.gatewayTransactionId,
        },
      });
      await paymentRepository.attachOrder(payment._id.toString(), order._id.toString());

      await auditService.log(req, {
        event: 'ORDER_PLACED',
        userId,
        success: true,
        detail: `order ${order._id} total ${total} txn ${payment.gatewayTransactionId}`,
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
