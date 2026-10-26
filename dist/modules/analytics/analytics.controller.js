"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyticsController = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const dayjs_1 = __importDefault(require("dayjs"));
const Booking_1 = require("@/models/Booking");
const Enquiry_1 = require("@/models/Enquiry");
const Provider_1 = require("@/models/Provider");
const report_1 = require("@/services/pdf/report");
const dates_1 = require("@/common/utils/dates");
const respond_1 = require("@/common/http/respond");
const AppError_1 = require("@/common/errors/AppError");
const errorCodes_1 = require("@/common/errors/errorCodes");
function getPeriodDateRange(period = 'this_month') {
    const now = (0, dates_1.nowIST)();
    let startDate = now.startOf('month').format('YYYY-MM-DD');
    let endDate = now.endOf('month').format('YYYY-MM-DD');
    if (period === 'last_3_months') {
        startDate = now.subtract(2, 'month').startOf('month').format('YYYY-MM-DD');
        endDate = now.endOf('month').format('YYYY-MM-DD');
    }
    else if (period === 'this_year') {
        startDate = now.startOf('year').format('YYYY-MM-DD');
        endDate = now.endOf('year').format('YYYY-MM-DD');
    }
    return { startDate, endDate };
}
exports.analyticsController = {
    // GET /analytics/overview
    async getOverview(req, res) {
        const providerId = req.auth.sub;
        const period = req.query.period || 'this_month';
        const { startDate, endDate } = getPeriodDateRange(period);
        const provObjId = new mongoose_1.default.Types.ObjectId(providerId);
        const completedBookings = await Booking_1.Booking.find({
            providerId: provObjId,
            status: 'completed',
            eventDate: { $gte: startDate, $lte: endDate },
        }).lean();
        const totalRevenue = completedBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
        const completedEvents = completedBookings.length;
        const totalGuestsServed = completedBookings.reduce((sum, b) => sum + (b.guestCount || 0), 0);
        const avgEventValue = completedEvents > 0 ? Math.round(totalRevenue / completedEvents) : 0;
        const startDateTime = (0, dayjs_1.default)(startDate).startOf('day').toDate();
        const endDateTime = (0, dayjs_1.default)(endDate).endOf('day').toDate();
        const enquiries = await Enquiry_1.Enquiry.find({
            providerId: provObjId,
            createdAt: { $gte: startDateTime, $lte: endDateTime },
        }).lean();
        const totalEnquiries = enquiries.length;
        const converted = enquiries.filter((e) => e.status === 'confirmed' || e.status === 'completed' || e.bookingId).length;
        const conversionRatePercent = totalEnquiries > 0 ? Math.round((converted / totalEnquiries) * 1000) / 10 : 0;
        return respond_1.respond.ok(req, res, {
            totalRevenue,
            completedEvents,
            totalGuestsServed,
            conversionRatePercent,
            avgEventValue,
        });
    },
    // GET /analytics/revenue-chart
    async getRevenueChart(req, res) {
        const providerId = req.auth.sub;
        const year = parseInt(req.query.year, 10) || (0, dates_1.nowIST)().year();
        const provObjId = new mongoose_1.default.Types.ObjectId(providerId);
        const startYear = `${year}-01-01`;
        const endYear = `${year}-12-31`;
        const completedBookings = await Booking_1.Booking.find({
            providerId: provObjId,
            status: 'completed',
            eventDate: { $gte: startYear, $lte: endYear },
        }).lean();
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const currentYear = (0, dates_1.nowIST)().year();
        const currentMonthIdx = (0, dates_1.nowIST)().month(); // 0-indexed
        const maxMonth = year === currentYear ? currentMonthIdx : 11;
        const chartData = [];
        for (let i = 0; i <= maxMonth; i++) {
            const monthPrefix = `${year}-${String(i + 1).padStart(2, '0')}`;
            const monthBookings = completedBookings.filter((b) => b.eventDate.startsWith(monthPrefix));
            const revenue = monthBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
            const events = monthBookings.length;
            chartData.push({
                month: months[i],
                revenue,
                events,
            });
        }
        return respond_1.respond.ok(req, res, chartData);
    },
    // GET /analytics/export
    async exportAnalytics(req, res) {
        const providerId = req.auth.sub;
        const format = (req.query.format || 'pdf').toLowerCase();
        const period = req.query.period || 'this_month';
        const provider = await Provider_1.Provider.findById(providerId);
        if (!provider) {
            throw new AppError_1.AppError(404, errorCodes_1.ERROR_CODES.NOT_FOUND, 'Provider not found');
        }
        const { startDate, endDate } = getPeriodDateRange(period);
        const provObjId = new mongoose_1.default.Types.ObjectId(providerId);
        const completedBookings = await Booking_1.Booking.find({
            providerId: provObjId,
            status: 'completed',
            eventDate: { $gte: startDate, $lte: endDate },
        }).lean();
        const totalRevenue = completedBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
        const completedEvents = completedBookings.length;
        const totalGuestsServed = completedBookings.reduce((sum, b) => sum + (b.guestCount || 0), 0);
        const avgEventValue = completedEvents > 0 ? Math.round(totalRevenue / completedEvents) : 0;
        const startDateTime = (0, dayjs_1.default)(startDate).startOf('day').toDate();
        const endDateTime = (0, dayjs_1.default)(endDate).endOf('day').toDate();
        const totalEnquiries = await Enquiry_1.Enquiry.countDocuments({
            providerId: provObjId,
            createdAt: { $gte: startDateTime, $lte: endDateTime },
        });
        const converted = await Enquiry_1.Enquiry.countDocuments({
            providerId: provObjId,
            createdAt: { $gte: startDateTime, $lte: endDateTime },
            status: { $in: ['confirmed', 'completed'] },
        });
        const conversionRatePercent = totalEnquiries > 0 ? Math.round((converted / totalEnquiries) * 1000) / 10 : 0;
        const exportData = {
            period,
            totalRevenue,
            completedEvents,
            totalGuestsServed,
            conversionRatePercent,
            avgEventValue,
        };
        let downloadUrl = '';
        if (format === 'csv') {
            downloadUrl = await (0, report_1.exportAnalyticsCsv)(provider, exportData);
        }
        else {
            downloadUrl = await (0, report_1.exportAnalyticsPdf)(provider, exportData);
        }
        return respond_1.respond.ok(req, res, { downloadUrl });
    },
};
