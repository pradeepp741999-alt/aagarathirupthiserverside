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
exports.Notification = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const constants_1 = require("@/config/constants");
const notificationSchema = new mongoose_1.Schema({
    recipientRole: {
        type: String,
        enum: constants_1.APP_ROLES,
        required: true,
        index: true,
    },
    recipientId: {
        type: mongoose_1.Schema.Types.ObjectId,
        required: true,
        index: true,
    },
    type: {
        type: String,
        enum: constants_1.NOTIFICATION_TYPES,
        required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },
    referenceType: {
        type: String,
        enum: ['enquiry', 'booking', 'review', 'provider', 'document'],
    },
    referenceId: { type: String },
    createdAt: {
        type: Date,
        default: Date.now,
        index: { expires: 180 * 24 * 60 * 60 }, // 180 days TTL
    },
}, {
    timestamps: true,
    versionKey: false,
    strict: true,
});
notificationSchema.index({ recipientRole: 1, recipientId: 1, isRead: 1, createdAt: -1 });
exports.Notification = mongoose_1.default.model('Notification', notificationSchema, 'notifications');
