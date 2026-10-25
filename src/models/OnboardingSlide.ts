import mongoose, { Schema, Document } from 'mongoose';
import { APP_ROLES, AppRole } from '@/config/constants';

export interface IOnboardingSlide extends Document {
  role: AppRole;
  order: number;
  title: string;
  subtitle: string;
  image: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const onboardingSlideSchema = new Schema<IOnboardingSlide>(
  {
    role: {
      type: String,
      enum: APP_ROLES,
      required: true,
      index: true,
    },
    order: { type: Number, default: 0 },
    title: { type: String, required: true },
    subtitle: { type: String, required: true },
    image: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: true,
  }
);

export const OnboardingSlide = mongoose.model<IOnboardingSlide>(
  'OnboardingSlide',
  onboardingSlideSchema,
  'onboarding_slides'
);
