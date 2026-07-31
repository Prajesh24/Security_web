import mongoose, { Document, Schema } from 'mongoose';

export interface IOrderItem {
  productId: mongoose.Types.ObjectId;
  name: string; // snapshot at purchase time
  price: number; // server-authoritative price snapshot
  quantity: number;
}

export interface IOrderPayment {
  paymentId: mongoose.Types.ObjectId;
  cardBrand: string;
  cardLast4: string; // display only — never the full PAN
  transactionId: string;
}

export interface IOrder extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  items: IOrderItem[];
  total: number; // computed server-side, never trusted from the client
  status: 'placed' | 'shipped' | 'delivered' | 'cancelled';
  payment: IOrderPayment;
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema<IOrderItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false },
);

const orderPaymentSchema = new Schema<IOrderPayment>(
  {
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment', required: true },
    cardBrand: { type: String, required: true },
    cardLast4: { type: String, required: true },
    transactionId: { type: String, required: true },
  },
  { _id: false },
);

const orderSchema = new Schema<IOrder>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    items: { type: [orderItemSchema], required: true },
    total: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['placed', 'shipped', 'delivered', 'cancelled'],
      default: 'placed',
    },
    payment: { type: orderPaymentSchema, required: true },
  },
  { timestamps: true },
);

export const OrderModel = mongoose.model<IOrder>('Order', orderSchema);
