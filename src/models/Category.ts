import mongoose, { Schema, Document } from 'mongoose';
import { CATEGORIES, CategorySlug } from '@/config/constants';

export interface ICategory extends Document<string> {
  _id: CategorySlug;
  name: string;
  icon: string; // Ionicons for user app
  providerIcon: string; // Lucide for provider app
  color: string;
  description: string;
  startingPriceHint: number;
  highlights: string[];
  serviceScope: string[];
  eventTypes: string[];
  services: string[];
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const categorySchema = new Schema<ICategory>(
  {
    _id: {
      type: String,
      enum: CATEGORIES,
      required: true,
    },
    name: { type: String, required: true },
    icon: { type: String, required: true },
    providerIcon: { type: String, required: true },
    color: { type: String, required: true },
    description: { type: String, required: true },
    startingPriceHint: { type: Number, default: 0 },
    highlights: [{ type: String }],
    serviceScope: [{ type: String }],
    eventTypes: [{ type: String }],
    services: [{ type: String }],
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: true,
  }
);

export const Category = mongoose.model<ICategory>('Category', categorySchema, 'categories');
