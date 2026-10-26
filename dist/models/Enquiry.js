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
exports.Enquiry = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const constants_1 = require("@/config/constants");
const enquirySchema = new mongoose_1.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
    },
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true,
    },
    providerId: {
        type: mongoose_1.Schema.Types.ObjectId,
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
        category: { type: String, enum: constants_1.CATEGORIES },
    },
    category: {
        type: String,
        enum: constants_1.CATEGORIES,
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
            dishId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Dish' },
            packageId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'MenuPackage' },
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
        enum: constants_1.ENQUIRY_STATUSES,
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
            status: { type: String, enum: constants_1.ENQUIRY_STATUSES },
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
    bookingId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Booking' },
    reviewId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Review' },
    hasReview: { type: Boolean, default: false },
    cancelledBy: { type: String, enum: ['customer', 'provider'] },
    cancelReason: { type: String },
    rejectionReason: { type: String },
}, {
    timestamps: true,
    versionKey: false,
    strict: true,
});
enquirySchema.index({ providerId: 1, status: 1, createdAt: -1 });
enquirySchema.index({ userId: 1, createdAt: -1 });
enquirySchema.index({ providerId: 1, eventDate: 1 });
enquirySchema.index({ providerId: 1, 'customer.mobile': 1 });
exports.Enquiry = mongoose_1.default.model('Enquiry', enquirySchema, 'enquiries');
