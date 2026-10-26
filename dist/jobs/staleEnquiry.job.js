"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkStaleEnquiries = checkStaleEnquiries;
exports.scheduleStaleEnquiryJob = scheduleStaleEnquiryJob;
const node_cron_1 = __importDefault(require("node-cron"));
const Enquiry_js_1 = require("../models/Enquiry.js");
const Provider_js_1 = require("../models/Provider.js");
const notify_service_js_1 = require("../services/notify.service.js");
const logger_js_1 = require("../config/logger.js");
const dates_js_1 = require("../common/utils/dates.js");
async function checkStaleEnquiries() {
    const cutoff = (0, dates_js_1.nowIST)().subtract(24, 'hours').toDate();
    logger_js_1.logger.info({ cutoff }, 'Starting stale enquiry check job');
    try {
        const staleEnquiries = await Enquiry_js_1.Enquiry.find({
            status: 'submitted',
            createdAt: { $lt: cutoff },
        });
        for (const enquiry of staleEnquiries) {
            enquiry.status = 'cancelled';
            enquiry.cancelledBy = 'provider';
            enquiry.cancelReason = 'Auto-expired due to no response from provider within 24 hours';
            enquiry.timeline.push({
                kind: 'status',
                status: 'cancelled',
                author: 'system',
                message: 'Auto-expired due to no response from provider within 24 hours',
                at: new Date(),
            });
            await enquiry.save();
            const provider = await Provider_js_1.Provider.findById(enquiry.providerId);
            const providerName = provider?.businessName || 'the provider';
            // Notify User
            await notify_service_js_1.notifyService.createNotification({
                recipientRole: 'user',
                recipientId: enquiry.userId,
                type: 'enquiry_update',
                title: 'Enquiry Expired',
                message: `Your enquiry (${enquiry.code}) to ${providerName} has expired as the provider did not respond within 24 hours.`,
                referenceType: 'enquiry',
                referenceId: enquiry._id.toString(),
            });
            // Notify Provider
            await notify_service_js_1.notifyService.createNotification({
                recipientRole: 'provider',
                recipientId: enquiry.providerId,
                type: 'enquiry_update',
                title: 'Enquiry Missed & Expired',
                message: `Enquiry (${enquiry.code}) has expired due to no response within 24 hours.`,
                referenceType: 'enquiry',
                referenceId: enquiry._id.toString(),
            });
        }
        logger_js_1.logger.info({ count: staleEnquiries.length }, 'Stale enquiry check completed');
    }
    catch (err) {
        logger_js_1.logger.error({ err }, 'Error in stale enquiry job');
    }
}
function scheduleStaleEnquiryJob() {
    // Run hourly at minute 0
    return node_cron_1.default.schedule('0 * * * *', checkStaleEnquiries, {
        timezone: 'Asia/Kolkata',
    });
}
