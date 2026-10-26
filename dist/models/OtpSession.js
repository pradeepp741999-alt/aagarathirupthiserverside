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
exports.OtpSession = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const constants_1 = require("@/config/constants");
const otpSessionSchema = new mongoose_1.Schema({
    mobile: {
        type: String,
        required: true,
        match: /^[6-9]\d{9}$/,
    },
    role: {
        type: String,
        enum: constants_1.APP_ROLES,
        required: true,
    },
    txnId: {
        type: String,
        required: true,
        unique: true,
    },
    otpHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    sendCount: { type: Number, default: 1 },
    windowStartedAt: { type: Date, default: Date.now },
    lastSentAt: { type: Date, default: Date.now },
    expiresAt: {
        type: Date,
        required: true,
        index: { expires: 0 },
    },
    consumedAt: { type: Date },
}, {
    timestamps: true,
    versionKey: false,
    strict: true,
});
otpSessionSchema.index({ mobile: 1, role: 1, createdAt: -1 });
exports.OtpSession = mongoose_1.default.model('OtpSession', otpSessionSchema, 'otp_sessions');
