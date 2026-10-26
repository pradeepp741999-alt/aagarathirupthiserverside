"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkDocumentExpiry = checkDocumentExpiry;
exports.scheduleDocumentExpiryJob = scheduleDocumentExpiryJob;
const node_cron_1 = __importDefault(require("node-cron"));
const ProviderDocument_js_1 = require("../models/ProviderDocument.js");
const notify_service_js_1 = require("../services/notify.service.js");
const logger_js_1 = require("../config/logger.js");
const dates_js_1 = require("../common/utils/dates.js");
async function checkDocumentExpiry() {
    const todayStr = (0, dates_js_1.nowIST)().format('YYYY-MM-DD');
    logger_js_1.logger.info({ today: todayStr }, 'Starting document expiry check job');
    try {
        // 1. Mark already expired documents
        const expiredDocs = await ProviderDocument_js_1.ProviderDocument.find({
            status: 'verified',
            expiryDate: { $lt: todayStr },
        });
        for (const doc of expiredDocs) {
            doc.status = 'expired';
            await doc.save();
            await notify_service_js_1.notifyService.createNotification({
                recipientRole: 'provider',
                recipientId: doc.providerId,
                type: 'document',
                title: 'Document Expired',
                message: `Your ${doc.type.toUpperCase()} document has expired. Please re-upload a valid document to maintain your verified status.`,
                referenceType: 'document',
                referenceId: doc._id.toString(),
            });
        }
        // 2. Alert for documents expiring in 30, 7, and 1 day(s)
        const intervals = [
            { days: 30, label: '30 days' },
            { days: 7, label: '7 days' },
            { days: 1, label: '24 hours' },
        ];
        for (const interval of intervals) {
            const targetDate = (0, dates_js_1.nowIST)().add(interval.days, 'day').format('YYYY-MM-DD');
            const expiringDocs = await ProviderDocument_js_1.ProviderDocument.find({
                status: 'verified',
                expiryDate: targetDate,
            });
            for (const doc of expiringDocs) {
                await notify_service_js_1.notifyService.createNotification({
                    recipientRole: 'provider',
                    recipientId: doc.providerId,
                    type: 'document',
                    title: 'Document Expiring Soon',
                    message: `Your ${doc.type.toUpperCase()} document will expire in ${interval.label}. Please upload an updated copy soon.`,
                    referenceType: 'document',
                    referenceId: doc._id.toString(),
                });
            }
        }
        logger_js_1.logger.info({ processedExpired: expiredDocs.length }, 'Document expiry check completed');
    }
    catch (err) {
        logger_js_1.logger.error({ err }, 'Error in document expiry job');
    }
}
function scheduleDocumentExpiryJob() {
    // Run daily at 09:00 IST
    return node_cron_1.default.schedule('0 9 * * *', checkDocumentExpiry, {
        timezone: 'Asia/Kolkata',
    });
}
