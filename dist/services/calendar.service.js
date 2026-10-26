"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.calendarService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const dayjs_1 = __importDefault(require("dayjs"));
const ProviderAvailability_1 = require("@/models/ProviderAvailability");
const Provider_1 = require("@/models/Provider");
const dates_1 = require("@/common/utils/dates");
const AppError_1 = require("@/common/errors/AppError");
const errorCodes_1 = require("@/common/errors/errorCodes");
exports.calendarService = {
    async checkRangeAvailability(providerId, startDate, endDate = startDate) {
        const dates = (0, dates_1.eachDay)(startDate, endDate);
        const provider = await Provider_1.Provider.findById(providerId).select('settings').lean();
        const noticeDays = provider?.settings?.advanceNoticeDays ?? 3;
        const today = (0, dates_1.todayIST)();
        const minBookableDate = (0, dayjs_1.default)(today).add(noticeDays, 'day').format('YYYY-MM-DD');
        const blockedRecords = await ProviderAvailability_1.ProviderAvailability.find({
            providerId: new mongoose_1.default.Types.ObjectId(providerId),
            date: { $in: dates },
        }).lean();
        const blockedMap = new Map();
        for (const rec of blockedRecords) {
            blockedMap.set(rec.date, rec.status);
        }
        const blockedDates = [];
        const reasons = {};
        for (const d of dates) {
            if (blockedMap.has(d)) {
                const status = blockedMap.get(d);
                blockedDates.push(d);
                reasons[d] = status;
            }
            else if (d < minBookableDate) {
                blockedDates.push(d);
                reasons[d] = 'notice_period';
            }
        }
        return {
            isAvailable: blockedDates.length === 0,
            blockedDates,
            reasons,
        };
    },
    async blockDates(providerId, dates, bookingId, note, session) {
        const existingBooked = await ProviderAvailability_1.ProviderAvailability.find({
            providerId: new mongoose_1.default.Types.ObjectId(providerId),
            date: { $in: dates },
        }).session(session || null);
        if (existingBooked.length > 0) {
            const conflictDates = existingBooked.map((b) => b.date);
            throw new AppError_1.AppError(409, errorCodes_1.ERROR_CODES.DATE_ALREADY_BOOKED, `Selected date(s) are already booked or blocked: ${conflictDates.join(', ')}`);
        }
        const docs = dates.map((date) => ({
            providerId: new mongoose_1.default.Types.ObjectId(providerId),
            date,
            status: 'booked',
            bookingId,
            note,
        }));
        await ProviderAvailability_1.ProviderAvailability.insertMany(docs, { session });
    },
    async freeDates(providerId, bookingId, session) {
        await ProviderAvailability_1.ProviderAvailability.deleteMany({
            providerId: new mongoose_1.default.Types.ObjectId(providerId),
            bookingId,
        }, { session });
    },
    async getMonthCalendar(providerId, year, month) {
        const startOfMonth = (0, dayjs_1.default)(`${year}-${String(month).padStart(2, '0')}-01`);
        const endOfMonth = startOfMonth.endOf('month');
        const allDays = (0, dates_1.eachDay)(startOfMonth.format('YYYY-MM-DD'), endOfMonth.format('YYYY-MM-DD'));
        const storedDays = await ProviderAvailability_1.ProviderAvailability.find({
            providerId: new mongoose_1.default.Types.ObjectId(providerId),
            date: { $in: allDays },
        }).lean();
        const map = new Map();
        for (const s of storedDays) {
            map.set(s.date, {
                status: s.status,
                note: s.note,
                bookingId: s.bookingId?.toString(),
            });
        }
        let availableCount = 0;
        let bookedCount = 0;
        let blockedCount = 0;
        const dates = allDays.map((date) => {
            const entry = map.get(date);
            const status = entry ? entry.status : 'available';
            if (status === 'booked')
                bookedCount++;
            else if (status === 'blocked')
                blockedCount++;
            else
                availableCount++;
            return {
                date,
                status,
                note: entry?.note,
                bookingId: entry?.bookingId,
            };
        });
        return {
            year,
            month,
            stats: {
                availableCount,
                bookedCount,
                blockedCount,
            },
            dates,
        };
    },
};
