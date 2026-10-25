import mongoose, { Schema, Document } from 'mongoose';
import { APP_ROLES, AppRole } from '@/config/constants';

export interface IOtpSession extends Document {
  mobile: string;
  role: AppRole;
  txnId: string;
  otpHash: string;
  attempts: number;
  sendCount: number;
  windowStartedAt: Date;
  lastSentAt: Date;
  expiresAt: Date;
  consumedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const otpSessionSchema = new Schema<IOtpSession>(
  {
    mobile: {
      type: String,
      required: true,
      match: /^[6-9]\d{9}$/,
    },
    role: {
      type: String,
      enum: APP_ROLES,
      required: true,
    },
    txnId: {
      type: String,
      required: true,
      unique: true,
    },
    otpHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    sendCount: { type: Number, default: 1 },
    windowStartedAt: { type: Date, default: Date.now },
    lastSentAt: { type: Date, default: Date.now },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
    consumedAt: { type: Date },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: true,
  }
);

otpSessionSchema.index({ mobile: 1, role: 1, createdAt: -1 });

export const OtpSession = mongoose.model<IOtpSession>(
  'OtpSession',
  otpSessionSchema,
  'otp_sessions'
);
