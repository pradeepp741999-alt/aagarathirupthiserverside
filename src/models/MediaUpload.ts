import mongoose, { Schema, Document } from 'mongoose';
import { APP_ROLES, AppRole } from '@/config/constants';

export const MEDIA_CATEGORIES = [
  'provider_documents',
  'dishes',
  'combos',
  'covers',
  'portfolio',
  'reviews',
  'avatars',
] as const;
export type MediaCategory = (typeof MEDIA_CATEGORIES)[number];

export interface IMediaUpload extends Document {
  ownerRole: AppRole;
  ownerId: mongoose.Types.ObjectId;
  category: MediaCategory;
  key: string;
  fileUrl: string;
  mimeType: string;
  status: 'pending' | 'uploaded';
  localToken?: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const mediaUploadSchema = new Schema<IMediaUpload>(
  {
    ownerRole: {
      type: String,
      enum: APP_ROLES,
      required: true,
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: MEDIA_CATEGORIES,
      required: true,
    },
    key: { type: String, required: true, unique: true },
    fileUrl: { type: String, required: true, index: true },
    mimeType: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'uploaded'],
      default: 'pending',
    },
    localToken: { type: String, index: true },
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

export const MediaUpload = mongoose.model<IMediaUpload>(
  'MediaUpload',
  mediaUploadSchema,
  'media_uploads'
);
