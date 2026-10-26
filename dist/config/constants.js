"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TIMEZONE_IST = exports.DEFAULT_ADVANCE_NOTICE_DAYS = exports.DEFAULT_ADVANCE_PERCENTAGE = exports.MAX_ACTIVE_COMBOS_PER_PROVIDER = exports.CRM_THRESHOLDS = exports.DISH_CATEGORIES = exports.DEFAULT_LOGO_COLOR = exports.AVATAR_PALETTE = exports.NOTIFICATION_TYPES = exports.CRM_TAGS = exports.CRM_STAGES = exports.VEG_PREFERENCES = exports.PRICING_MODELS = exports.CALENDAR_STATUSES = exports.PAYMENT_METHODS = exports.PAYMENT_STATUSES = exports.BOOKING_STATUSES = exports.ENQUIRY_STATUSES = exports.DOCUMENT_STATUSES = exports.ALL_DOC_TYPES = exports.REQUIRED_DOC_TYPES = exports.PROVIDER_STATUSES = exports.CATEGORIES = exports.APP_ROLES = void 0;
exports.APP_ROLES = ['user', 'provider', 'admin'];
exports.CATEGORIES = ['catering', 'decoration', 'audio', 'makeup'];
exports.PROVIDER_STATUSES = [
    'draft',
    'pending',
    'under_review',
    'approved',
    'rejected',
    'suspended',
];
exports.REQUIRED_DOC_TYPES = ['aadhaar', 'pan'];
exports.ALL_DOC_TYPES = ['aadhaar', 'pan', 'gst', 'trade_license', 'fssai'];
exports.DOCUMENT_STATUSES = ['missing', 'uploaded', 'verified', 'rejected', 'expired'];
exports.ENQUIRY_STATUSES = [
    'submitted',
    'provider_reviewing',
    'quote_sent',
    'accepted',
    'confirmed',
    'completed',
    'cancelled',
    'rejected',
];
exports.BOOKING_STATUSES = ['confirmed', 'in_progress', 'completed', 'cancelled'];
exports.PAYMENT_STATUSES = ['unpaid', 'partially_paid', 'paid'];
exports.PAYMENT_METHODS = ['upi', 'cash', 'bank_transfer'];
exports.CALENDAR_STATUSES = ['available', 'blocked', 'booked'];
exports.PRICING_MODELS = ['per_plate', 'per_event', 'fixed', 'hourly'];
exports.VEG_PREFERENCES = ['veg', 'non_veg', 'both'];
exports.CRM_STAGES = ['new_lead', 'contacted', 'quoted', 'booked', 'completed', 'lost'];
exports.CRM_TAGS = ['repeat', 'vip', 'high_value', 'recent'];
exports.NOTIFICATION_TYPES = [
    'new_enquiry',
    'quote_received',
    'enquiry_update',
    'booking',
    'review',
    'approval',
    'document',
    'system',
    'promotion',
];
exports.AVATAR_PALETTE = [
    '#8B5CF6',
    '#EC4899',
    '#F97316',
    '#3B82F6',
    '#10B981',
    '#EAB308',
];
exports.DEFAULT_LOGO_COLOR = '#0E7C7B';
exports.DISH_CATEGORIES = [
    { slug: 'starters', label: 'Starters' },
    { slug: 'main', label: 'Main Course' },
    { slug: 'rice', label: 'Rice' },
    { slug: 'curries', label: 'Curries' },
    { slug: 'breads', label: 'Breads' },
    { slug: 'sweets', label: 'Sweets' },
    { slug: 'drinks', label: 'Drinks' },
    { slug: 'non_veg', label: 'Non-Veg' },
];
exports.CRM_THRESHOLDS = {
    REPEAT_BOOKINGS_MIN: 2,
    VIP_BOOKINGS_MIN: 3,
    VIP_SPENT_MIN: 250000,
    HIGH_VALUE_SPENT_MIN: 100000,
    RECENT_DAYS_MAX: 30,
};
exports.MAX_ACTIVE_COMBOS_PER_PROVIDER = 10;
exports.DEFAULT_ADVANCE_PERCENTAGE = 30;
exports.DEFAULT_ADVANCE_NOTICE_DAYS = 3;
exports.TIMEZONE_IST = 'Asia/Kolkata';
