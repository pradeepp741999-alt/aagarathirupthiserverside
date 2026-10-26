"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Provider = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const constants_1 = require("@/config/constants");
const providerSchema = new mongoose_1.Schema({
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
    logoColor: { type: String, default: constants_1.DEFAULT_LOGO_COLOR },
    coverImage: { type: String },
    portfolioImages: [
        {
            url: { type: String, required: true },
            caption: { type: String },
        },
    ],
    category: { type: String, enum: constants_1.CATEGORIES },
    secondaryCategories: [{ type: String, enum: constants_1.CATEGORIES }],
    serviceDetails: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    vegPreference: { type: String, enum: constants_1.VEG_PREFERENCES },
    cuisineTypes: [{ type: String }],
    minCapacity: { type: Number },
    maxCapacity: { type: Number },
    maxDailyClients: { type: Number },
    yearsActive: { type: Number },
    pricing: {
        model: { type: String, enum: constants_1.PRICING_MODELS, default: 'per_plate' },
        startingPrice: { type: Number, default: 0 },
        advancePercentage: { type: Number, default: constants_1.DEFAULT_ADVANCE_PERCENTAGE },
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
        advanceNoticeDays: { type: Number, default: constants_1.DEFAULT_ADVANCE_NOTICE_DAYS },
        autoAcceptEnquiries: { type: Boolean, default: false },
    },
    status: {
        type: String,
        enum: constants_1.PROVIDER_STATUSES,
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
}, {
    timestamps: true,
    versionKey: false,
    strict: true,
});
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
exports.Provider = mongoose_1.default.model('Provider', providerSchema, 'providers');
