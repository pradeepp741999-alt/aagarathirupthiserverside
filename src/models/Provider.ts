import mongoose, { Schema, Document } from 'mongoose';
import {
  CATEGORIES,
  CategorySlug,
  PROVIDER_STATUSES,
  ProviderStatus,
  PRICING_MODELS,
  PricingModel,
  VEG_PREFERENCES,
  VegPreference,
  DEFAULT_LOGO_COLOR,
  DEFAULT_ADVANCE_PERCENTAGE,
  DEFAULT_ADVANCE_NOTICE_DAYS,
} from '@/config/constants';

export interface IProviderPortfolioImage {
  url: string;
  caption?: string;
}

export interface IProviderPricing {
  model: PricingModel;
  startingPrice: number;
  advancePercentage: number;
  cancellationPolicy?: string;
  paymentTerms?: string;
}

export interface IProviderCoverage {
  districts: string[];
  isAllDistricts: boolean;
  areas: string[];
  travelsOutstation: boolean;
  outstationFeePerKm?: number;
}

export interface IProviderSettings {
  advanceNoticeDays: number;
  autoAcceptEnquiries: boolean;
}

export interface IRatingBreakdown {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
}

export interface IProvider extends Document {
  mobile: string;
  whatsapp?: string;
  email?: string;
  businessName?: string;
  ownerName?: string;
  tagline?: string;
  description?: string;
  logoColor: string;
  coverImage?: string;
  portfolioImages: IProviderPortfolioImage[];
  category?: CategorySlug;
  secondaryCategories: CategorySlug[];
  serviceDetails?: Record<string, any>;
  vegPreference?: VegPreference;
  cuisineTypes: string[];
  minCapacity?: number;
  maxCapacity?: number;
  maxDailyClients?: number;
  yearsActive?: number;
  pricing: IProviderPricing;
  coverage: IProviderCoverage;
  district?: string;
  geo?: {
    lat: number;
    lng: number;
  };
  settings: IProviderSettings;
  status: ProviderStatus;
  rejectionReason?: string;
  submittedAt?: Date;
  approvedAt?: Date;
  reviewedBy?: string;
  termsAcceptedAt?: Date;
  registrationStep: number;
  completedSteps: number[];
  verified: boolean;
  isOnline: boolean;
  isActive: boolean;
  rating: number;
  ratingBreakdown: IRatingBreakdown;
  reviewCount: number;
  avgResponseMinutes: number;
  createdAt: Date;
  updatedAt: Date;
}

const providerSchema = new Schema<IProvider>(
  {
    mobile: {
      type: String,
      required: true,
      unique: true,
      match: /^[6-9]\d{9}$/,
    },
    whatsapp: { type: String },
    email: { type: String },
    businessName: { type: String },
    ownerName: { type: String },
    tagline: { type: String },
    description: { type: String },
    logoColor: { type: String, default: DEFAULT_LOGO_COLOR },
    coverImage: { type: String },
    portfolioImages: [
      {
        url: { type: String, required: true },
        caption: { type: String },
      },
    ],
    category: { type: String, enum: CATEGORIES },
    secondaryCategories: [{ type: String, enum: CATEGORIES }],
    serviceDetails: { type: Schema.Types.Mixed, default: {} },
    vegPreference: { type: String, enum: VEG_PREFERENCES },
    cuisineTypes: [{ type: String }],
    minCapacity: { type: Number },
    maxCapacity: { type: Number },
    maxDailyClients: { type: Number },
    yearsActive: { type: Number },
    pricing: {
      model: { type: String, enum: PRICING_MODELS, default: 'per_plate' },
      startingPrice: { type: Number, default: 0 },
      advancePercentage: { type: Number, default: DEFAULT_ADVANCE_PERCENTAGE },
      cancellationPolicy: { type: String },
      paymentTerms: { type: String },
    },
    coverage: {
      districts: [{ type: String }],
      isAllDistricts: { type: Boolean, default: false },
      areas: [{ type: String }],
      travelsOutstation: { type: Boolean, default: false },
      outstationFeePerKm: { type: Number, default: 0 },
    },
    district: { type: String },
    geo: {
      lat: { type: Number },
      lng: { type: Number },
    },
    settings: {
      advanceNoticeDays: { type: Number, default: DEFAULT_ADVANCE_NOTICE_DAYS },
      autoAcceptEnquiries: { type: Boolean, default: false },
    },
    status: {
      type: String,
      enum: PROVIDER_STATUSES,
      default: 'draft',
    },
    rejectionReason: { type: String },
    submittedAt: { type: Date },
    approvedAt: { type: Date },
    reviewedBy: { type: String },
    termsAcceptedAt: { type: Date },
    registrationStep: { type: Number, default: 1, min: 1, max: 7 },
    completedSteps: [{ type: Number }],
    verified: { type: Boolean, default: false },
    isOnline: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    rating: { type: Number, default: 0 },
    ratingBreakdown: {
      1: { type: Number, default: 0 },
      2: { type: Number, default: 0 },
      3: { type: Number, default: 0 },
      4: { type: Number, default: 0 },
      5: { type: Number, default: 0 },
    },
    reviewCount: { type: Number, default: 0 },
    avgResponseMinutes: { type: Number, default: 120 },
  },
  {
    timestamps: true,
    versionKey: false,
    strict: true,
  }
);

providerSchema.index({ status: 1, isActive: 1, category: 1 });
providerSchema.index({ secondaryCategories: 1 });
providerSchema.index({ 'coverage.districts': 1 });
providerSchema.index({ rating: -1 });
providerSchema.index({
  businessName: 'text',
  tagline: 'text',
  description: 'text',
  cuisineTypes: 'text',
});

export const Provider = mongoose.model<IProvider>('Provider', providerSchema, 'providers');
