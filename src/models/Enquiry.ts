import mongoose, { Schema, Document } from 'mongoose';
import {
  CATEGORIES,
  CategorySlug,
  ENQUIRY_STATUSES,
  CanonicalEnquiryStatus,
} from '@/config/constants';

export interface IEnquiryCustomerSnapshot {
  name?: string | null;
  mobile: string;
  whatsapp?: string | null;
  email?: string | null;
  avatarColor?: string | null;
}

export interface IEnquiryProviderSnapshot {
  businessName?: string;
  category?: CategorySlug;
}

export interface IEnquiryStaffing {
  leadArtists: number;
  backupArtists: number;
  hoursPerPerson: {
    min: number;
    max: number;
  };
  estimatedHours: {
    min: number;
    max: number;
  };
}

export interface IEnquiryItem {
  dishId?: mongoose.Types.ObjectId;
  packageId?: mongoose.Types.ObjectId;
  name: string;
  price: number;
  qty: number;
}

export interface IEnquiryQuote {
  amount: number;
  validUntil?: string; // YYYY-MM-DD
  inclusions: string[];
  terms?: string;
  message?: string;
  sentAt: Date;
}

export interface IEnquiryTimeline {
  kind: 'status' | 'message' | 'note';
  status?: CanonicalEnquiryStatus;
  author: 'customer' | 'provider' | 'system';
  message: string;
  at: Date;
}

export interface IEnquiry extends Document {
  code: string;
  userId: mongoose.Types.ObjectId;
  providerId: mongoose.Types.ObjectId;
  customer: IEnquiryCustomerSnapshot;
  providerSnapshot: IEnquiryProviderSnapshot;
  category: CategorySlug;
  eventType: string;
  location: string;
  district: string;
  eventDate: string; // YYYY-MM-DD
  eventEndDate?: string; // YYYY-MM-DD
  eventTime?: string;
  mealType?: 'breakfast' | 'lunch' | 'dinner' | 'snacks';
  guestCount: number;
  makeupPersonsCount?: number;
  simultaneousStyling?: boolean;
  backupArtistAssigned?: boolean;
  staffing?: IEnquiryStaffing;
  items: IEnquiryItem[];
  estimatedTotal: number;
  budgetMin?: number;
  budgetMax?: number;
  notes?: string;
  status: CanonicalEnquiryStatus;
  quote?: IEnquiryQuote;
  timeline: IEnquiryTimeline[];
  isNewLead: boolean;
  staleReminderSent: boolean;
  firstRespondedAt?: Date;
  bookingId?: mongoose.Types.ObjectId;
  reviewId?: mongoose.Types.ObjectId;
  hasReview: boolean;
  cancelledBy?: 'customer' | 'provider';
  cancelReason?: string;
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const enquirySchema = new Schema<IEnquiry>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    providerId: {
      type: Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
    },
    customer: {
      name: { type: String },
      mobile: { type: String, required: true },
      whatsapp: { type: String },
      email: { type: String },
      avatarColor: { type: String },
    },
    providerSnapshot: {
      businessName: { type: String },
      category: { type: String, enum: CATEGORIES },
    },
    category: {
      type: String,
      enum: CATEGORIES,
      required: true,
    },
    eventType: { type: String, required: true },
    location: { type: String, required: true },
    district: { type: String, required: true },
    eventDate: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    eventEndDate: {
      type: String,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    eventTime: { type: String },
    mealType: {
      type: String,
      enum: ['breakfast', 'lunch', 'dinner', 'snacks'],
    },
    guestCount: { type: Number, required: true, min: 1 },
    makeupPersonsCount: { type: Number },
    simultaneousStyling: { type: Boolean },
    backupArtistAssigned: { type: Boolean },
    staffing: {
      leadArtists: { type: Number },
      backupArtists: { type: Number },
      hoursPerPerson: {
        min: { type: Number },
        max: { type: Number },
      },
      estimatedHours: {
        min: { type: Number },
        max: { type: Number },
      },
    },
    items: [
      {
        dishId: { type: Schema.Types.ObjectId, ref: 'Dish' },
        packageId: { type: Schema.Types.ObjectId, ref: 'MenuPackage' },
        name: { type: String, required: true },
        price: { type: Number, required: true, min: 0 },
        qty: { type: Number, required: true, min: 1 },
      },
    ],
    estimatedTotal: { type: Number, required: true, min: 0 },
    budgetMin: { type: Number },
    budgetMax: { type: Number },
    notes: { type: String },
    status: {
      type: String,
      enum: ENQUIRY_STATUSES,
      default: 'submitted',
    },
    quote: {
      amount: { type: Number },
      validUntil: { type: String },
      inclusions: [{ type: String }],
      terms: { type: String },
      message: { type: String },
      sentAt: { type: Date },
    },
    timeline: [
      {
        kind: {
          type: String,
          enum: ['status', 'message', 'note'],
          required: true,
        },
        status: { type: String, enum: ENQUIRY_STATUSES },
        author: {
          type: String,
          enum: ['customer', 'provider', 'system'],
          required: true,
        },
        message: { type: String, required: true },
        at: { type: Date, default: Date.now },
      },
    ],
    isNewLead: { type: Boolean, default: true },
    staleReminderSent: { type: Boolean, default: false },
    firstRespondedAt: { type: Date },
    bookingId: { type: Schema.Types.ObjectId, ref: 'Booking' },
    reviewId: { type: Schema.Types.ObjectId, ref: 'Review' },
    hasReview: { type: Boolean, default: false },
    cancelledBy: { type: String, enum: ['customer', 'provider'] },
    cancelReason: { type: String },
    rejectionReason: { type: String },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: true,
  }
);

enquirySchema.index({ providerId: 1, status: 1, createdAt: -1 });
enquirySchema.index({ userId: 1, createdAt: -1 });
enquirySchema.index({ providerId: 1, eventDate: 1 });
enquirySchema.index({ providerId: 1, 'customer.mobile': 1 });

export const Enquiry = mongoose.model<IEnquiry>('Enquiry', enquirySchema, 'enquiries');
