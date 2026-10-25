import mongoose, { Schema, Document } from 'mongoose';

export interface IReviewRatings {
  quality: number;
  communication: number;
  value: number;
  timeliness: number;
}

export interface IReviewProviderReply {
  text: string;
  repliedAt: Date;
}

export interface IReview extends Document {
  providerId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  enquiryId: mongoose.Types.ObjectId;
  bookingId?: mongoose.Types.ObjectId;
  customerName: string;
  avatarColor?: string;
  eventType?: string;
  rating: number; // 1 to 5
  ratings: IReviewRatings;
  comment: string;
  photos: string[];
  providerReply?: IReviewProviderReply;
  status: 'published' | 'hidden';
  createdAt: Date;
  updatedAt: Date;
}

const reviewSchema = new Schema<IReview>(
  {
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
    enquiryId: {
      type: Schema.Types.ObjectId,
      ref: 'Enquiry',
      required: true,
      unique: true,
    },
    bookingId: {
      type: Schema.Types.ObjectId,
      ref: 'Booking',
    },
    customerName: { type: String, required: true },
    avatarColor: { type: String },
    eventType: { type: String },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    ratings: {
      quality: { type: Number, min: 1, max: 5 },
      communication: { type: Number, min: 1, max: 5 },
      value: { type: Number, min: 1, max: 5 },
      timeliness: { type: Number, min: 1, max: 5 },
    },
    comment: { type: String, required: true },
    photos: [{ type: String }],
    providerReply: {
      text: { type: String },
      repliedAt: { type: Date },
    },
    status: {
      type: String,
      enum: ['published', 'hidden'],
      default: 'published',
    },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: true,
  }
);

reviewSchema.index({ providerId: 1, status: 1, rating: 1, createdAt: -1 });

export const Review = mongoose.model<IReview>('Review', reviewSchema, 'reviews');
