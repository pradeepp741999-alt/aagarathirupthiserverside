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
exports.ProviderDocument = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const constants_1 = require("@/config/constants");
const providerDocumentSchema = new mongoose_1.Schema({
    providerId: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Provider',
        required: true,
    },
    type: {
        type: String,
        enum: constants_1.ALL_DOC_TYPES,
        required: true,
    },
    numberEnc: { type: String },
    numberMasked: { type: String },
    fileUrl: { type: String, required: true },
    expiryDate: { type: String },
    status: {
        type: String,
        enum: constants_1.DOCUMENT_STATUSES,
        default: 'uploaded',
    },
    rejectionReason: { type: String },
    verifiedAt: { type: Date },
    verifiedBy: { type: String },
    lastReminderDays: { type: Number },
}, {
    timestamps: true,
    versionKey: false,
    strict: true,
});
providerDocumentSchema.index({ providerId: 1, type: 1 }, { unique: true });
exports.ProviderDocument = mongoose_1.default.model('ProviderDocument', providerDocumentSchema, 'provider_documents');
