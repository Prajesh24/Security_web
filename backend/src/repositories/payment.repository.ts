import { PaymentModel, IPayment } from '../models/payment.model';

export class PaymentRepository {
  create(data: Partial<IPayment>): Promise<IPayment> {
    return PaymentModel.create(data);
  }

  findByIdempotencyKey(idempotencyKey: string): Promise<IPayment | null> {
    return PaymentModel.findOne({ idempotencyKey }).exec();
  }

  attachOrder(paymentId: string, orderId: string): Promise<IPayment | null> {
    return PaymentModel.findByIdAndUpdate(paymentId, { orderId }, { new: true }).exec();
  }
}
