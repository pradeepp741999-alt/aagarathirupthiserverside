"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.availabilityController = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const dayjs_1 = __importDefault(require("dayjs"));
const ProviderAvailability_1 = require("@/models/ProviderAvailability");
const calendar_service_1 = require("@/services/calendar.service");
const dates_1 = require("@/common/utils/dates");
const respond_1 = require("@/common/http/respond");
const AppError_1 = require("@/common/errors/AppError");
const errorCodes_1 = require("@/common/errors/errorCodes");
exports.availabilityController = {
    async getMonth(req, res) {
        const providerId = req.auth.sub;
        const year = parseInt(req.query.year, 10) || (0, dayjs_1.default)().year();
        const month = parseInt(req.query.month, 10) || (0, dayjs_1.default)().month() + 1;
        if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
            throw new AppError_1.AppError(422, errorCodes_1.ERROR_CODES.VALIDATION_ERROR, 'Invalid year or month');
        }
        const data = await calendar_service_1.calendarService.getMonthCalendar(providerId, year, month);
        return respond_1.respond.ok(req, res, data);
    },
    async updateDate(req, res) {
        const providerId = req.auth.sub;
        // In alias PUT /providers/:id/calendar/date, verify :id is self
        if (req.params.id && req.params.id !== providerId) {
            throw new AppError_1.AppError(403, errorCodes_1.ERROR_CODES.FORBIDDEN, 'Cannot modify calendar of another provider');
        }
        const { date, status, note } = req.body;
        if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            throw new AppError_1.AppError(422, errorCodes_1.ERROR_CODES.VALIDATION_ERROR, 'date must be in YYYY-MM-DD format');
        }
        const today = (0, dates_1.todayIST)();
        if (date < today) {
            throw new AppError_1.AppError(422, errorCodes_1.ERROR_CODES.VALIDATION_ERROR, 'Cannot modify calendar dates in the past');
        }
        const normalizedStatus = status === 'unavailable' ? 'blocked' : status;
        if (!['available', 'blocked', 'booked'].includes(normalizedStatus)) {
            throw new AppError_1.AppError(422, errorCodes_1.ERROR_CODES.VALIDATION_ERROR, "status must be 'available', 'blocked', or 'booked'");
        }
        const provObjId = new mongoose_1.default.Types.ObjectId(providerId);
        // Check if booked by an active booking
        const existing = await ProviderAvailability_1.ProviderAvailability.findOne({
            providerId: provObjId,
            date,
        });
        if (existing && existing.bookingId) {
            throw new AppError_1.AppError(409, errorCodes_1.ERROR_CODES.DATE_HAS_BOOKING, 'Cannot modify availability for a date that has a confirmed booking');
        }
        if (normalizedStatus === 'available') {
            await ProviderAvailability_1.ProviderAvailability.deleteOne({ providerId: provObjId, date });
            return respond_1.respond.ok(req, res, { date, status: 'available' });
        }
        await ProviderAvailability_1.ProviderAvailability.findOneAndUpdate({ providerId: provObjId, date }, {
            providerId: provObjId,
            date,
            status: normalizedStatus,
            note,
        }, { upsert: true, new: true });
        return respond_1.respond.ok(req, res, { date, status: normalizedStatus });
    },
    async bulkUpdate(req, res) {
        const providerId = req.auth.sub;
        const { startDate, endDate, status, note } = req.body;
        if (!startDate || !endDate) {
            throw new AppError_1.AppError(422, errorCodes_1.ERROR_CODES.VALIDATION_ERROR, 'start_date and end_date are required');
        }
        const today = (0, dates_1.todayIST)();
        if (startDate < today) {
            throw new AppError_1.AppError(422, errorCodes_1.ERROR_CODES.VALIDATION_ERROR, 'start_date cannot be in the past');
        }
        const allDates = (0, dates_1.eachDay)(startDate, endDate);
        if (allDates.length > 62) {
            throw new AppError_1.AppError(422, errorCodes_1.ERROR_CODES.VALIDATION_ERROR, 'Bulk date range cannot exceed 62 days');
        }
        const normalizedStatus = status === 'unavailable' ? 'blocked' : status;
        const provObjId = new mongoose_1.default.Types.ObjectId(providerId);
        // Find all days in range that have a booking
        const bookedDays = await ProviderAvailability_1.ProviderAvailability.find({
            providerId: provObjId,
            date: { $in: allDates },
            bookingId: { $exists: true, $ne: null },
        }).lean();
        const bookedDateSet = new Set(bookedDays.map((b) => b.date));
        const skippedDates = allDates.filter((d) => bookedDateSet.has(d));
        const datesToUpdate = allDates.filter((d) => !bookedDateSet.has(d));
        if (normalizedStatus === 'available') {
            await ProviderAvailability_1.ProviderAvailability.deleteMany({
                providerId: provObjId,
                date: { $in: datesToUpdate },
            });
        }
        else {
            const ops = datesToUpdate.map((d) => ({
                updateOne: {
                    filter: { providerId: provObjId, date: d },
                    update: {
                        $set: {
                            providerId: provObjId,
                            date: d,
                            status: normalizedStatus,
                            note,
                        },
                    },
                    upsert: true,
                },
            }));
            if (ops.length > 0) {
                await ProviderAvailability_1.ProviderAvailability.bulkWrite(ops);
            }
        }
        const count = datesToUpdate.length;
        return respond_1.respond.ok(req, res, {
            updatedCount: count,
            skippedDates,
        }, {
            message: `${count} dates updated to ${normalizedStatus}`,
        });
    },
};
