import mongoose, { Document, Schema } from 'mongoose';

export interface IPayment extends Document {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  orderId?: mongoose.Types.ObjectId; // set once the order is created (approved payments only)
  amount: number;
  currency: string;
  status: 'approved' | 'declined';
  cardBrand: string;
  cardLast4: string;
  gatewayTransactionId: string;
  declineReason?: string;
  idempotencyKey: string;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: 'npr' },
    status: { type: String, enum: ['approved', 'declined'], required: true },
    cardBrand: { type: String, required: true },
    cardLast4: { type: String, required: true },
    gatewayTransactionId: { type: String, required: true },
    declineReason: { type: String },
    // Unique per attempt so a retried/replayed request cannot double-charge.
    idempotencyKey: { type: String, required: true, unique: true },
  },
  { timestamps: true },
);

export const PaymentModel = mongoose.model<IPayment>('Payment', paymentSchema);
