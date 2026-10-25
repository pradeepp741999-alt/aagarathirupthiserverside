import mongoose, { Schema, Document } from 'mongoose';
import { ALL_DOC_TYPES, DocumentType, DOCUMENT_STATUSES, DocumentStatus } from '@/config/constants';

export interface IProviderDocument extends Document {
  providerId: mongoose.Types.ObjectId;
  type: DocumentType;
  numberEnc?: string;
  numberMasked?: string;
  fileUrl: string;
  expiryDate?: string;
  status: DocumentStatus;
  rejectionReason?: string;
  verifiedAt?: Date;
  verifiedBy?: string;
  lastReminderDays?: number;
  createdAt: Date;
  updatedAt: Date;
}

const providerDocumentSchema = new Schema<IProviderDocument>(
  {
    providerId: {
      type: Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
    },
    type: {
      type: String,
      enum: ALL_DOC_TYPES,
      required: true,
    },
    numberEnc: { type: String },
    numberMasked: { type: String },
    fileUrl: { type: String, required: true },
    expiryDate: { type: String },
    status: {
      type: String,
      enum: DOCUMENT_STATUSES,
      default: 'uploaded',
    },
    rejectionReason: { type: String },
    verifiedAt: { type: Date },
    verifiedBy: { type: String },
    lastReminderDays: { type: Number },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: true,
  }
);

providerDocumentSchema.index({ providerId: 1, type: 1 }, { unique: true });

export const ProviderDocument = mongoose.model<IProviderDocument>(
  'ProviderDocument',
  providerDocumentSchema,
  'provider_documents'
);
