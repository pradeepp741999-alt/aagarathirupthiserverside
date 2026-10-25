import mongoose, { Schema, Document } from 'mongoose';
import { CATEGORIES, CategorySlug } from '@/config/constants';

export interface ISpecialCombo extends Document {
  providerId: mongoose.Types.ObjectId;
  category: CategorySlug;
  name: string;
  description?: string;
  includedItems: string[];
  price: number;
  originalPrice?: number;
  imageUrl: string;
  validUntil: Date;
  badge?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const specialComboSchema = new Schema<ISpecialCombo>(
  {
    providerId: {
      type: Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
    },
    category: {
      type: String,
      enum: CATEGORIES,
      required: true,
    },
    name: { type: String, required: true },
    description: { type: String },
    includedItems: [{ type: String }],
    price: { type: Number, required: true, min: 0 },
    originalPrice: { type: Number },
    imageUrl: { type: String, required: true },
    validUntil: { type: Date, required: true },
    badge: { type: String },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: true,
  }
);

specialComboSchema.index({ isActive: 1, validUntil: 1 });
specialComboSchema.index({ providerId: 1 });

export const SpecialCombo = mongoose.model<ISpecialCombo>(
  'SpecialCombo',
  specialComboSchema,
  'special_combos'
);
