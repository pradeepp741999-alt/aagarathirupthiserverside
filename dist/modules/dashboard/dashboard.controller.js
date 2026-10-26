"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardController = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const dayjs_1 = __importDefault(require("dayjs"));
const Enquiry_1 = require("@/models/Enquiry");
const Booking_1 = require("@/models/Booking");
const dates_1 = require("@/common/utils/dates");
const respond_1 = require("@/common/http/respond");
exports.dashboardController = {
    async getMetrics(req, res) {
        const providerId = req.auth.sub;
        const provObjId = new mongoose_1.default.Types.ObjectId(providerId);
        const today = (0, dates_1.todayIST)();
        // 1. Enquiries metrics
        const enquiries = await Enquiry_1.Enquiry.find({ providerId: provObjId }).lean();
        let activeEnquiries = 0;
        let quotePending = 0;
        const ninetyDaysAgo = (0, dayjs_1.default)().subtract(90, 'day').toDate();
        let totalLast90 = 0;
        let answeredLast90 = 0;
        for (const e of enquiries) {
            if (['submitted', 'provider_reviewing', 'quote_sent', 'accepted'].includes(e.status)) {
                activeEnquiries++;
            }
            if (['submitted', 'provider_reviewing'].includes(e.status)) {
                quotePending++;
            }
            if (e.createdAt >= ninetyDaysAgo) {
                totalLast90++;
                if (e.firstRespondedAt || e.status !== 'submitted') {
                    answeredLast90++;
                }
            }
        }
        const responseRatePercent = totalLast90 > 0 ? Math.round((answeredLast90 / totalLast90) * 100) : 100;
        // 2. Bookings metrics
        const bookings = await Booking_1.Booking.find({ providerId: provObjId }).lean();
        let upcomingBookings = 0;
        const startOfMonth = (0, dates_1.nowIST)().startOf('month').toDate();
        const endOfMonth = (0, dates_1.nowIST)().endOf('month').toDate();
        let monthEarnings = 0;
        for (const b of bookings) {
            if (b.status === 'confirmed' && b.eventDate >= today) {
                upcomingBookings++;
            }
            if (b.status !== 'cancelled' && b.payments) {
                for (const p of b.payments) {
                    if (p.paidAt && p.paidAt >= startOfMonth && p.paidAt <= endOfMonth) {
                        monthEarnings += p.amount;
                    }
                }
            }
        }
        const metrics = {
            activeEnquiries,
            quotePending,
            upcomingBookings,
            monthEarnings,
            responseRatePercent,
        };
        return respond_1.respond.ok(req, res, metrics);
    },
};
