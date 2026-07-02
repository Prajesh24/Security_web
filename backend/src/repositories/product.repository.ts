import { ProductModel, IProduct } from '../models/product.model';

export class ProductRepository {
  create(data: Partial<IProduct>): Promise<IProduct> {
    return ProductModel.create(data);
  }

  findAll(): Promise<IProduct[]> {
    return ProductModel.find().sort({ createdAt: -1 }).exec();
  }

  findById(id: string): Promise<IProduct | null> {
    return ProductModel.findById(id).exec();
  }

  updateById(id: string, data: Partial<IProduct>): Promise<IProduct | null> {
    return ProductModel.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  deleteById(id: string): Promise<IProduct | null> {
    return ProductModel.findByIdAndDelete(id).exec();
  }

  /**
   * Atomically decrement stock only if enough is available. The conditional
   * filter makes the check-and-decrement a single atomic op (no oversell race).
   * Returns null if there wasn't enough stock.
   */
  decrementStock(id: string, qty: number): Promise<IProduct | null> {
    return ProductModel.findOneAndUpdate(
      { _id: id, stock: { $gte: qty } },
      { $inc: { stock: -qty } },
      { new: true },
    ).exec();
  }
}
