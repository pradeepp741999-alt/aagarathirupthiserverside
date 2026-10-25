import mongoose, { Schema, Document } from 'mongoose';

export interface IProviderAvailability extends Document {
  providerId: mongoose.Types.ObjectId;
  date: string; // YYYY-MM-DD
  status: 'blocked' | 'booked';
  note?: string;
  bookingId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const providerAvailabilitySchema = new Schema<IProviderAvailability>(
  {
    providerId: {
      type: Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
    },
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    status: {
      type: String,
      enum: ['blocked', 'booked'],
      required: true,
    },
    note: { type: String },
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
    },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: true,
  }
);

providerAvailabilitySchema.index({ providerId: 1, date: 1 }, { unique: true });

export const ProviderAvailability = mongoose.model<IProviderAvailability>(
  'ProviderAvailability',
  providerAvailabilitySchema,
  'provider_availability'
);
