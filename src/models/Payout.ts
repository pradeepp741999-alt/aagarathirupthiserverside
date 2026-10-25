import mongoose, { Schema, Document } from 'mongoose';

export interface IPayout extends Document {
  providerId: mongoose.Types.ObjectId;
  amount: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  method: 'direct_neft' | 'upi';
  utrNumber?: string;
  payoutDate: string; // YYYY-MM-DD
  periodFrom?: string;
  periodTo?: string;
  bookingIds: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const payoutSchema = new Schema<IPayout>(
  {
    providerId: {
      type: Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
    },
    amount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    method: {
      type: String,
      enum: ['direct_neft', 'upi'],
      default: 'direct_neft',
    },
    utrNumber: { type: String },
    payoutDate: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    periodFrom: { type: String },
    periodTo: { type: String },
    bookingIds: [{ type: Schema.Types.ObjectId, ref: 'Booking' }],
  },
  {
    timestamps: true,
    versionKey: false,
    strict: true,
  }
);

payoutSchema.index({ providerId: 1, payoutDate: -1 });

export const Payout = mongoose.model<IPayout>('Payout', payoutSchema, 'payouts');
