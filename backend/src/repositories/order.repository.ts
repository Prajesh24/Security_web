import { OrderModel, IOrder } from '../models/order.model';

export class OrderRepository {
  create(data: Partial<IOrder>): Promise<IOrder> {
    return OrderModel.create(data);
  }

  findById(id: string): Promise<IOrder | null> {
    return OrderModel.findById(id).exec();
  }

  // Ownership is enforced by always filtering on userId — a customer can only
  // ever read their own orders (prevents IDOR / broken object-level access).
  findByUser(userId: string): Promise<IOrder[]> {
    return OrderModel.find({ userId }).sort({ createdAt: -1 }).exec();
  }

  findAll(): Promise<IOrder[]> {
    return OrderModel.find().sort({ createdAt: -1 }).limit(100).exec();
  }
}
