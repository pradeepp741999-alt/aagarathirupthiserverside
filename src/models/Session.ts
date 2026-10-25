import mongoose, { Schema, Document } from 'mongoose';
import { APP_ROLES, AppRole } from '@/config/constants';

export interface ISession extends Document {
  subjectId: mongoose.Types.ObjectId;
  role: AppRole;
  refreshHash: string;
  pushToken?: string;
  deviceInfo?: string;
  revokedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const sessionSchema = new Schema<ISession>(
  {
    subjectId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: APP_ROLES,
      required: true,
    },
    refreshHash: {
      type: String,
      required: true,
      unique: true,
    },
    pushToken: { type: String },
    deviceInfo: { type: String },
    revokedAt: { type: Date },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 },
    },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: true,
  }
);

sessionSchema.index({ subjectId: 1, role: 1 });

export const Session = mongoose.model<ISession>('Session', sessionSchema, 'sessions');
