"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.documentsController = void 0;
const Provider_1 = require("@/models/Provider");
const ProviderDocument_1 = require("@/models/ProviderDocument");
const storage_1 = require("@/services/storage");
const crypto_1 = require("@/common/utils/crypto");
const mask_1 = require("@/common/utils/mask");
const dates_1 = require("@/common/utils/dates");
const constants_1 = require("@/config/constants");
const respond_1 = require("@/common/http/respond");
const AppError_1 = require("@/common/errors/AppError");
const errorCodes_1 = require("@/common/errors/errorCodes");
const DOC_TITLES = {
    aadhaar: 'Aadhaar Card',
    pan: 'PAN Card',
    gst: 'GST Registration Certificate',
    trade_license: 'Trade / Business License',
    fssai: 'FSSAI Food Safety Certificate',
};
function validateDocumentNumberFormat(type, num, expiryDate) {
    if (!num)
        return;
    const clean = num.trim();
    if (type === 'aadhaar' && !/^\d{12}$/.test(clean)) {
        throw new AppError_1.AppError(422, errorCodes_1.ERROR_CODES.VALIDATION_ERROR, 'Aadhaar must be a 12-digit number');
    }
    if (type === 'pan' && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(clean.toUpperCase())) {
        throw new AppError_1.AppError(422, errorCodes_1.ERROR_CODES.VALIDATION_ERROR, 'PAN must be 10 characters (e.g. ABCDE1234F)');
    }
    if (type === 'gst' &&
        !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(clean.toUpperCase())) {
        throw new AppError_1.AppError(422, errorCodes_1.ERROR_CODES.VALIDATION_ERROR, 'Invalid GST number format');
    }
    if (type === 'fssai') {
        if (!/^\d{14}$/.test(clean)) {
            throw new AppError_1.AppError(422, errorCodes_1.ERROR_CODES.VALIDATION_ERROR, 'FSSAI must be a 14-digit license number');
        }
        if (!expiryDate || expiryDate <= (0, dates_1.todayIST)()) {
            throw new AppError_1.AppError(422, errorCodes_1.ERROR_CODES.VALIDATION_ERROR, 'FSSAI requires a future expiry date');
        }
    }
}
exports.documentsController = {
    async getDocuments(req, res) {
        const providerId = req.auth.sub;
        const provider = await Provider_1.Provider.findById(providerId).lean();
        if (!provider) {
            throw new AppError_1.AppError(404, errorCodes_1.ERROR_CODES.NOT_FOUND, 'Provider not found');
        }
        const isCatering = provider.category === 'catering' ||
            (provider.secondaryCategories || []).includes('catering');
        const applicableTypes = ['aadhaar', 'pan', 'gst', 'trade_license'];
        if (isCatering) {
            applicableTypes.push('fssai');
        }
        const docs = await ProviderDocument_1.ProviderDocument.find({ providerId: provider._id }).lean();
        const docMap = new Map();
        for (const d of docs) {
            docMap.set(d.type, d);
        }
        const today = (0, dates_1.todayIST)();
        const result = applicableTypes.map((type) => {
            const doc = docMap.get(type);
            let status = 'missing';
            if (doc) {
                if (doc.expiryDate && doc.expiryDate < today) {
                    status = 'expired';
                }
                else {
                    status = doc.status;
                }
            }
            return {
                type,
                title: DOC_TITLES[type] || type,
                status,
                number: doc?.numberMasked || null,
                fileUrl: doc?.fileUrl || null,
                expiryDate: doc?.expiryDate || null,
                rejectionReason: doc?.rejectionReason || null,
                isRequired: constants_1.REQUIRED_DOC_TYPES.includes(type),
            };
        });
        return respond_1.respond.ok(req, res, result);
    },
    async updateDocument(req, res) {
        const providerId = req.auth.sub;
        const docType = req.params.type;
        const { number, expiryDate, fileUrl } = req.body;
        if (!fileUrl) {
            throw new AppError_1.AppError(422, errorCodes_1.ERROR_CODES.VALIDATION_ERROR, 'file_url is required');
        }
        await storage_1.storage.assertOwned(fileUrl, {
            ownerRole: 'provider',
            ownerId: providerId,
        });
        validateDocumentNumberFormat(docType, number, expiryDate);
        const masked = (0, mask_1.maskDocumentNumber)(docType, number);
        const enc = number ? (0, crypto_1.encryptDoc)(number.trim()) : undefined;
        await ProviderDocument_1.ProviderDocument.findOneAndUpdate({ providerId, type: docType }, {
            providerId,
            type: docType,
            fileUrl,
            numberMasked: masked || undefined,
            numberEnc: enc,
            expiryDate,
            status: 'uploaded',
            rejectionReason: undefined,
        }, { upsert: true, new: true });
        return respond_1.respond.ok(req, res, undefined, {
            message: 'Document uploaded and submitted for reverification.',
        });
    },
};
