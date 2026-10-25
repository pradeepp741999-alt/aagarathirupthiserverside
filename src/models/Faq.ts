import mongoose, { Schema, Document } from 'mongoose';

export interface IFaq extends Document {
  role: 'user' | 'provider' | 'both';
  question: string;
  answer: string;
  order: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const faqSchema = new Schema<IFaq>(
  {
    role: {
      type: String,
      enum: ['user', 'provider', 'both'],
      required: true,
      index: true,
    },
    question: { type: String, required: true },
    answer: { type: String, required: true },
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: true,
  }
);

export const Faq = mongoose.model<IFaq>('Faq', faqSchema, 'faqs');
