import mongoose, { Schema, Document } from 'mongoose';

export interface IDish extends Document {
  providerId: mongoose.Types.ObjectId;
  name: string;
  category: string;
  price: number;
  isVeg: boolean;
  isPopular: boolean;
  isActive: boolean;
  photoUrl?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

const dishSchema = new Schema<IDish>(
  {
    providerId: {
      type: Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
    },
    name: { type: String, required: true },
    category: { type: String, required: true, lowercase: true, trim: true },
    price: { type: Number, required: true, min: 0 },
    isVeg: { type: Boolean, required: true },
    isPopular: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    photoUrl: { type: String },
    description: { type: String },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: true,
  }
);

dishSchema.index({ providerId: 1, isActive: 1, category: 1 });

export const Dish = mongoose.model<IDish>('Dish', dishSchema, 'dishes');
