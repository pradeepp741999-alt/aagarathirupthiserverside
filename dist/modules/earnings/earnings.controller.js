"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.earningsController = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Booking_1 = require("@/models/Booking");
const Payout_1 = require("@/models/Payout");
const env_1 = require("@/config/env");
const dates_1 = require("@/common/utils/dates");
const pagination_1 = require("@/common/http/pagination");
const respond_1 = require("@/common/http/respond");
function getNextTuesday() {
    const now = (0, dates_1.nowIST)();
    let day = now;
    // Day of week: 0 is Sunday, 2 is Tuesday
    while (day.day() !== 2 || day.isSame(now, 'day')) {
        day = day.add(1, 'day');
    }
    return day.format('YYYY-MM-DD');
}
exports.earningsController = {
    // GET /providers/earnings/summary
    async getSummary(req, res) {
        const providerId = req.auth.sub;
        const provObjId = new mongoose_1.default.Types.ObjectId(providerId);
        const commissionFactor = 1 - env_1.env.PLATFORM_COMMISSION_PERCENT / 100;
        const bookings = await Booking_1.Booking.find({
            providerId: provObjId,
            status: { $ne: 'cancelled' },
        }).lean();
        const startOfMonth = (0, dates_1.nowIST)().startOf('month').toDate();
        const endOfMonth = (0, dates_1.nowIST)().endOf('month').toDate();
        let totalLifetimeEarnings = 0;
        let thisMonthEarnings = 0;
        let escrowAdvanceHeld = 0;
        let completedPaymentsSum = 0;
        for (const b of bookings) {
            const isCompleted = b.status === 'completed';
            const isEscrow = b.status === 'confirmed' || b.status === 'in_progress';
            if (b.payments) {
                for (const p of b.payments) {
                    const amt = p.amount * commissionFactor;
                    totalLifetimeEarnings += amt;
                    if (p.paidAt && p.paidAt >= startOfMonth && p.paidAt <= endOfMonth) {
                        thisMonthEarnings += amt;
                    }
                    if (isEscrow) {
                        escrowAdvanceHeld += p.amount;
                    }
                    if (isCompleted) {
                        completedPaymentsSum += amt;
                    }
                }
            }
        }
        // Payouts deducted
        const payouts = await Payout_1.Payout.find({
            providerId: provObjId,
            status: { $ne: 'failed' },
        }).lean();
        const totalPaidOut = payouts.reduce((sum, p) => sum + p.amount, 0);
        const pendingPayout = Math.max(0, Math.round(completedPaymentsSum - totalPaidOut));
        const nextPayoutDate = getNextTuesday();
        const summary = {
            totalLifetimeEarnings: Math.round(totalLifetimeEarnings),
            thisMonthEarnings: Math.round(thisMonthEarnings),
            pendingPayout,
            escrowAdvanceHeld: Math.round(escrowAdvanceHeld),
            nextPayoutDate,
        };
        return respond_1.respond.ok(req, res, summary);
    },
    // GET /providers/earnings/transactions
    async getTransactions(req, res) {
        const providerId = req.auth.sub;
        const { page, limit, skip } = (0, pagination_1.parsePagination)(req.query);
        const provObjId = new mongoose_1.default.Types.ObjectId(providerId);
        const [payouts, total] = await Promise.all([
            Payout_1.Payout.find({ providerId: provObjId })
                .sort({ payoutDate: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),
            Payout_1.Payout.countDocuments({ providerId: provObjId }),
        ]);
        const items = payouts.map((p) => ({
            id: p._id.toString(),
            payoutDate: p.payoutDate,
            amount: p.amount,
            status: p.status,
            payoutMethod: p.method,
            utrNumber: p.utrNumber || null,
        }));
        return respond_1.respond.list(req, res, items, { page, limit, total });
    },
};
