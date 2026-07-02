import mongoose, { Document, Schema } from 'mongoose';

export interface IProduct extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string;
  price: number; // whole NPR for the demo
  category: string;
  imageUrl: string;
  stock: number;
  createdAt: Date;
  updatedAt: Date;
}

const productSchema = new Schema<IProduct>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: '', maxlength: 1000 },
    price: { type: Number, required: true, min: 0 },
    category: { type: String, default: 'General', index: true },
    imageUrl: { type: String, default: '' },
    stock: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: true },
);

export const ProductModel = mongoose.model<IProduct>('Product', productSchema);
