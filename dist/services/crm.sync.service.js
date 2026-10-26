"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.crmSyncService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const CrmCustomer_1 = require("@/models/CrmCustomer");
const Enquiry_1 = require("@/models/Enquiry");
const Booking_1 = require("@/models/Booking");
const constants_1 = require("@/config/constants");
exports.crmSyncService = {
    async recompute(providerId, mobile) {
        const provId = new mongoose_1.default.Types.ObjectId(providerId);
        const enquiries = await Enquiry_1.Enquiry.find({
            providerId: provId,
            'customer.mobile': mobile,
        })
            .sort({ createdAt: -1 })
            .lean();
        const bookings = await Booking_1.Booking.find({
            providerId: provId,
            'customer.mobile': mobile,
        })
            .sort({ eventDate: -1 })
            .lean();
        const nonCancelledBookings = bookings.filter((b) => b.status !== 'cancelled');
        const totalEnquiries = enquiries.length;
        const totalBookings = nonCancelledBookings.length;
        const totalSpent = nonCancelledBookings.reduce((sum, b) => sum + (b.advancePaid || 0), 0);
        let lastEventDate = undefined;
        if (nonCancelledBookings.length > 0) {
            lastEventDate = nonCancelledBookings[0].eventDate;
        }
        // Determine latest contact
        let lastContactAt = new Date(0);
        for (const enq of enquiries) {
            if (enq.timeline) {
                for (const t of enq.timeline) {
                    if (t.at && new Date(t.at) > lastContactAt) {
                        lastContactAt = new Date(t.at);
                    }
                }
            }
            if (enq.createdAt && new Date(enq.createdAt) > lastContactAt) {
                lastContactAt = new Date(enq.createdAt);
            }
        }
        const existingCustomer = await CrmCustomer_1.CrmCustomer.findOne({ providerId: provId, mobile }).lean();
        if (existingCustomer?.notes) {
            for (const n of existingCustomer.notes) {
                if (n.createdAt && new Date(n.createdAt) > lastContactAt) {
                    lastContactAt = new Date(n.createdAt);
                }
            }
        }
        if (lastContactAt.getTime() === 0) {
            lastContactAt = new Date();
        }
        // Determine stage
        let stage = 'new_lead';
        const hasActiveBooking = nonCancelledBookings.some((b) => b.status === 'confirmed' || b.status === 'in_progress');
        const hasCompletedBooking = nonCancelledBookings.some((b) => b.status === 'completed');
        if (hasActiveBooking) {
            stage = 'booked';
        }
        else if (hasCompletedBooking) {
            stage = 'completed';
        }
        else if (enquiries.some((e) => e.status === 'quote_sent' || e.status === 'accepted')) {
            stage = 'quoted';
        }
        else if (enquiries.some((e) => e.status === 'provider_reviewing')) {
            stage = 'contacted';
        }
        else if (enquiries.length > 0 &&
            enquiries.every((e) => e.status === 'cancelled' || e.status === 'rejected')) {
            stage = 'lost';
        }
        else {
            stage = 'new_lead';
        }
        // Determine tags
        const tags = [];
        if (totalBookings >= constants_1.CRM_THRESHOLDS.REPEAT_BOOKINGS_MIN) {
            tags.push('repeat');
        }
        if (totalSpent >= constants_1.CRM_THRESHOLDS.HIGH_VALUE_SPENT_MIN) {
            tags.push('high_value');
        }
        if (totalBookings >= constants_1.CRM_THRESHOLDS.VIP_BOOKINGS_MIN ||
            totalSpent >= constants_1.CRM_THRESHOLDS.VIP_SPENT_MIN) {
            tags.push('vip');
        }
        const daysSinceContact = (Date.now() - lastContactAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceContact <= constants_1.CRM_THRESHOLDS.RECENT_DAYS_MAX) {
            tags.push('recent');
        }
        // Name, avatar, userId snapshot from latest enquiry
        const latestEnq = enquiries[0];
        const name = latestEnq?.customer?.name || existingCustomer?.name || 'Customer';
        const whatsapp = latestEnq?.customer?.whatsapp || existingCustomer?.whatsapp;
        const email = latestEnq?.customer?.email || existingCustomer?.email;
        const district = latestEnq?.district || existingCustomer?.district;
        const city = district;
        const avatarColor = latestEnq?.customer?.avatarColor || existingCustomer?.avatarColor || '#8B5CF6';
        const userId = latestEnq?.userId || existingCustomer?.userId;
        await CrmCustomer_1.CrmCustomer.findOneAndUpdate({ providerId: provId, mobile }, {
            providerId: provId,
            userId,
            name,
            mobile,
            whatsapp,
            email,
            district,
            city,
            avatarColor,
            stage,
            totalEnquiries,
            totalBookings,
            totalSpent,
            lastEventDate,
            lastContactAt,
            tags,
        }, { upsert: true, new: true });
    },
};
