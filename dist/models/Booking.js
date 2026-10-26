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
exports.Booking = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const constants_1 = require("@/config/constants");
const bookingSchema = new mongoose_1.Schema({
    code: {
        type: String,
        required: true,
        unique: true,
    },
    enquiryId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Enquiry',
        required: true,
        unique: true,
    },
    providerId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Provider',
        required: true,
    },
    userId: {
        type: mongoose_1.Schema.Types.ObjectId,
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
        enum: constants_1.CATEGORIES,
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
            method: { type: String, enum: constants_1.PAYMENT_METHODS, required: true },
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
        enum: constants_1.PAYMENT_STATUSES,
        default: 'unpaid',
    },
    status: {
        type: String,
        enum: constants_1.BOOKING_STATUSES,
        default: 'confirmed',
    },
    invoiceUrl: { type: String },
    completedAt: { type: Date },
    cancelledAt: { type: Date },
    cancelledBy: { type: String, enum: ['customer', 'provider'] },
}, {
    timestamps: true,
    versionKey: false,
    strict: true,
});
bookingSchema.index({ providerId: 1, status: 1, eventDate: 1 });
bookingSchema.index({ providerId: 1, 'payments.paidAt': 1 });
exports.Booking = mongoose_1.default.model('Booking', bookingSchema, 'bookings');
