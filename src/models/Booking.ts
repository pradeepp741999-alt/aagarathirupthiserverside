import mongoose, { Schema, Document } from 'mongoose';
import {
  CATEGORIES,
  CategorySlug,
  BOOKING_STATUSES,
  BookingStatus,
  PAYMENT_STATUSES,
  PaymentStatus,
  PAYMENT_METHODS,
  PaymentMethod,
} from '@/config/constants';

export interface IBookingPayment {
  _id?: mongoose.Types.ObjectId;
  amount: number;
  method: PaymentMethod;
  referenceId?: string;
  notes?: string;
  receiptNo: string;
  paidAt: Date;
}

export interface IBookingCustomerSnapshot {
  name: string;
  mobile: string;
  email?: string;
  whatsapp?: string;
  avatarColor?: string;
}

export interface IBooking extends Document {
  code: string;
  enquiryId: mongoose.Types.ObjectId;
  providerId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  customer: IBookingCustomerSnapshot;
  category: CategorySlug;
  eventType: string;
  eventDate: string; // YYYY-MM-DD
  eventEndDate?: string;
  startTime?: string;
  venue: string;
  guestCount: number;
  totalAmount: number;
  advanceRequired: number;
  payments: IBookingPayment[];
  advancePaid: number;
  balanceDue: number;
  paymentStatus: PaymentStatus;
  status: BookingStatus;
  invoiceUrl?: string;
  completedAt?: Date;
  cancelledAt?: Date;
  cancelledBy?: 'customer' | 'provider';
  createdAt: Date;
  updatedAt: Date;
}

const bookingSchema = new Schema<IBooking>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
    },
    enquiryId: {
      type: Schema.Types.ObjectId,
      ref: 'Enquiry',
      required: true,
      unique: true,
    },
    providerId: {
      type: Schema.Types.ObjectId,
      ref: 'Provider',
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    customer: {
      name: { type: String, required: true },
      mobile: { type: String, required: true },
      email: { type: String },
      whatsapp: { type: String },
      avatarColor: { type: String },
    },
    category: {
      type: String,
      enum: CATEGORIES,
      required: true,
    },
    eventType: { type: String, required: true },
    eventDate: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    eventEndDate: {
      type: String,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    startTime: { type: String },
    venue: { type: String, required: true },
    guestCount: { type: Number, required: true, min: 1 },
    totalAmount: { type: Number, required: true, min: 0 },
    advanceRequired: { type: Number, required: true, min: 0 },
    payments: [
      {
        amount: { type: Number, required: true, min: 0 },
        method: { type: String, enum: PAYMENT_METHODS, required: true },
        referenceId: { type: String },
        notes: { type: String },
        receiptNo: { type: String, required: true },
        paidAt: { type: Date, default: Date.now },
      },
    ],
    advancePaid: { type: Number, default: 0 },
    balanceDue: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: PAYMENT_STATUSES,
      default: 'unpaid',
    },
    status: {
      type: String,
      enum: BOOKING_STATUSES,
      default: 'confirmed',
    },
    invoiceUrl: { type: String },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
    cancelledBy: { type: String, enum: ['customer', 'provider'] },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: true,
  }
);

bookingSchema.index({ providerId: 1, status: 1, eventDate: 1 });
bookingSchema.index({ providerId: 1, 'payments.paidAt': 1 });

export const Booking = mongoose.model<IBooking>('Booking', bookingSchema, 'bookings');
