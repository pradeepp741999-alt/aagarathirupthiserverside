import mongoose, { Schema, Document } from 'mongoose';
import {
  NOTIFICATION_TYPES,
  CanonicalNotificationType,
  APP_ROLES,
  AppRole,
} from '@/config/constants';

export interface INotification extends Document {
  recipientRole: AppRole;
  recipientId: mongoose.Types.ObjectId;
  type: CanonicalNotificationType;
  title: string;
  message: string;
  isRead: boolean;
  referenceType?: 'enquiry' | 'booking' | 'review' | 'provider' | 'document';
  referenceId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    recipientRole: {
      type: String,
      enum: APP_ROLES,
      required: true,
      index: true,
    },
    recipientId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    referenceType: {
      type: String,
      enum: ['enquiry', 'booking', 'review', 'provider', 'document'],
    },
    referenceId: { type: String },
    createdAt: {
      type: Date,
      default: Date.now,
      index: { expires: 180 * 24 * 60 * 60 }, // 180 days TTL
    },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: true,
  }
);

notificationSchema.index({ recipientRole: 1, recipientId: 1, isRead: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>(
  'Notification',
  notificationSchema,
  'notifications'
);
