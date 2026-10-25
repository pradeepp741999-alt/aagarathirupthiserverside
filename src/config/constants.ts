export const APP_ROLES = ['user', 'provider', 'admin'] as const;
export type AppRole = (typeof APP_ROLES)[number];

export const CATEGORIES = ['catering', 'decoration', 'audio', 'makeup'] as const;
export type CategorySlug = (typeof CATEGORIES)[number];

export const PROVIDER_STATUSES = [
  'draft',
  'pending',
  'under_review',
  'approved',
  'rejected',
  'suspended',
] as const;
export type ProviderStatus = (typeof PROVIDER_STATUSES)[number];

export const REQUIRED_DOC_TYPES = ['aadhaar', 'pan'] as const;
export const ALL_DOC_TYPES = ['aadhaar', 'pan', 'gst', 'trade_license', 'fssai'] as const;
export type DocumentType = (typeof ALL_DOC_TYPES)[number];

export const DOCUMENT_STATUSES = ['missing', 'uploaded', 'verified', 'rejected', 'expired'] as const;
export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const ENQUIRY_STATUSES = [
  'submitted',
  'provider_reviewing',
  'quote_sent',
  'accepted',
  'confirmed',
  'completed',
  'cancelled',
  'rejected',
] as const;
export type CanonicalEnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

export const BOOKING_STATUSES = ['confirmed', 'in_progress', 'completed', 'cancelled'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const PAYMENT_STATUSES = ['unpaid', 'partially_paid', 'paid'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ['upi', 'cash', 'bank_transfer'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const CALENDAR_STATUSES = ['available', 'blocked', 'booked'] as const;
export type CalendarStatus = (typeof CALENDAR_STATUSES)[number];

export const PRICING_MODELS = ['per_plate', 'per_event', 'fixed', 'hourly'] as const;
export type PricingModel = (typeof PRICING_MODELS)[number];

export const VEG_PREFERENCES = ['veg', 'non_veg', 'both'] as const;
export type VegPreference = (typeof VEG_PREFERENCES)[number];

export const CRM_STAGES = ['new_lead', 'contacted', 'quoted', 'booked', 'completed', 'lost'] as const;
export type CrmStage = (typeof CRM_STAGES)[number];

export const CRM_TAGS = ['repeat', 'vip', 'high_value', 'recent'] as const;
export type CrmTag = (typeof CRM_TAGS)[number];

export const NOTIFICATION_TYPES = [
  'new_enquiry',
  'quote_received',
  'enquiry_update',
  'booking',
  'review',
  'approval',
  'document',
  'system',
  'promotion',
] as const;
export type CanonicalNotificationType = (typeof NOTIFICATION_TYPES)[number];

export const AVATAR_PALETTE = [
  '#8B5CF6',
  '#EC4899',
  '#F97316',
  '#3B82F6',
  '#10B981',
  '#EAB308',
] as const;

export const DEFAULT_LOGO_COLOR = '#0E7C7B';

export const DISH_CATEGORIES = [
  { slug: 'starters', label: 'Starters' },
  { slug: 'main', label: 'Main Course' },
  { slug: 'rice', label: 'Rice' },
  { slug: 'curries', label: 'Curries' },
  { slug: 'breads', label: 'Breads' },
  { slug: 'sweets', label: 'Sweets' },
  { slug: 'drinks', label: 'Drinks' },
  { slug: 'non_veg', label: 'Non-Veg' },
] as const;

export const CRM_THRESHOLDS = {
  REPEAT_BOOKINGS_MIN: 2,
  VIP_BOOKINGS_MIN: 3,
  VIP_SPENT_MIN: 250000,
  HIGH_VALUE_SPENT_MIN: 100000,
  RECENT_DAYS_MAX: 30,
};

export const MAX_ACTIVE_COMBOS_PER_PROVIDER = 10;
export const DEFAULT_ADVANCE_PERCENTAGE = 30;
export const DEFAULT_ADVANCE_NOTICE_DAYS = 3;
export const TIMEZONE_IST = 'Asia/Kolkata';
