import mongoose, { Schema, Document } from 'mongoose';

export interface IMenuPackage extends Document {
  providerId: mongoose.Types.ObjectId;
  name: string;
  description?: string;
  pricePerPlate: number;
  minGuests: number;
  dishIds: mongoose.Types.ObjectId[];
  isActive: boolean;
  isVeg: boolean;
  imageUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const menuPackageSchema = new Schema<IMenuPackage>(
  {
    providerId: {
      type: Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
    },
    name: { type: String, required: true },
    description: { type: String },
    pricePerPlate: { type: Number, required: true, min: 0 },
    minGuests: { type: Number, required: true, default: 1 },
    dishIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Dish',
      },
    ],
    isActive: { type: Boolean, default: true },
    isVeg: { type: Boolean, default: true },
    imageUrl: { type: String },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: true,
  }
);

menuPackageSchema.index({ providerId: 1, isActive: 1 });

export const MenuPackage = mongoose.model<IMenuPackage>(
  'MenuPackage',
  menuPackageSchema,
  'menu_packages'
);
