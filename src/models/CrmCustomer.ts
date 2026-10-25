import mongoose, { Schema, Document } from 'mongoose';
import { CRM_STAGES, CrmStage } from '@/config/constants';

export interface ICrmNote {
  _id?: mongoose.Types.ObjectId;
  note: string;
  createdAt: Date;
}

export interface ICrmCustomer extends Document {
  providerId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  name?: string;
  mobile: string;
  whatsapp?: string;
  email?: string;
  district?: string;
  city?: string;
  avatarColor?: string;
  stage: CrmStage;
  totalEnquiries: number;
  totalBookings: number;
  totalSpent: number;
  lastEventDate?: string;
  lastContactAt: Date;
  tags: string[];
  notes: ICrmNote[];
  createdAt: Date;
  updatedAt: Date;
}

const crmCustomerSchema = new Schema<ICrmCustomer>(
  {
    providerId: {
      type: Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
    },
    name: { type: String, default: 'Customer' },
    mobile: { type: String, required: true },
    whatsapp: { type: String },
    email: { type: String },
    district: { type: String },
    city: { type: String },
    avatarColor: { type: String, default: '#8B5CF6' },
    stage: {
      type: String,
      enum: CRM_STAGES,
      default: 'new_lead',
    },
    totalEnquiries: { type: Number, default: 0 },
    totalBookings: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    lastEventDate: { type: String },
    lastContactAt: { type: Date, default: Date.now },
    tags: [{ type: String }],
    notes: [
      {
        note: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
    versionKey: false,
    strict: true,
  }
);

crmCustomerSchema.index({ providerId: 1, mobile: 1 }, { unique: true });
crmCustomerSchema.index({ providerId: 1, stage: 1 });
crmCustomerSchema.index({ providerId: 1, lastContactAt: -1 });

export const CrmCustomer = mongoose.model<ICrmCustomer>(
  'CrmCustomer',
  crmCustomerSchema,
  'crm_customers'
);
