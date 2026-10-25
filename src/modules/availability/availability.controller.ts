import { Request, Response } from 'express';
import mongoose from 'mongoose';
import dayjs from 'dayjs';
import { ProviderAvailability } from '@/models/ProviderAvailability';
import { calendarService } from '@/services/calendar.service';
import { todayIST, eachDay } from '@/common/utils/dates';
import { respond } from '@/common/http/respond';
import { AppError } from '@/common/errors/AppError';
import { ERROR_CODES } from '@/common/errors/errorCodes';

export const availabilityController = {
  async getMonth(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    const year = parseInt(req.query.year as string, 10) || dayjs().year();
    const month = parseInt(req.query.month as string, 10) || dayjs().month() + 1;

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'Invalid year or month');
    }

    const data = await calendarService.getMonthCalendar(providerId, year, month);
    return respond.ok(req, res, data);
  },

  async updateDate(req: Request, res: Response) {
    const providerId = req.auth!.sub;

    // In alias PUT /providers/:id/calendar/date, verify :id is self
    if (req.params.id && req.params.id !== providerId) {
      throw new AppError(403, ERROR_CODES.FORBIDDEN, 'Cannot modify calendar of another provider');
    }

    const { date, status, note } = req.body;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'date must be in YYYY-MM-DD format');
    }

    const today = todayIST();
    if (date < today) {
      throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'Cannot modify calendar dates in the past');
    }

    const normalizedStatus = status === 'unavailable' ? 'blocked' : status;
    if (!['available', 'blocked', 'booked'].includes(normalizedStatus)) {
      throw new AppError(
        422,
        ERROR_CODES.VALIDATION_ERROR,
        "status must be 'available', 'blocked', or 'booked'"
      );
    }

    const provObjId = new mongoose.Types.ObjectId(providerId);

    // Check if booked by an active booking
    const existing = await ProviderAvailability.findOne({
      providerId: provObjId,
      date,
    });

    if (existing && existing.bookingId) {
      throw new AppError(
        409,
        ERROR_CODES.DATE_HAS_BOOKING,
        'Cannot modify availability for a date that has a confirmed booking'
      );
    }

    if (normalizedStatus === 'available') {
      await ProviderAvailability.deleteOne({ providerId: provObjId, date });
      return respond.ok(req, res, { date, status: 'available' });
    }

    await ProviderAvailability.findOneAndUpdate(
      { providerId: provObjId, date },
      {
        providerId: provObjId,
        date,
        status: normalizedStatus,
        note,
      },
      { upsert: true, new: true }
    );

    return respond.ok(req, res, { date, status: normalizedStatus });
  },

  async bulkUpdate(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    const { startDate, endDate, status, note } = req.body;

    if (!startDate || !endDate) {
      throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'start_date and end_date are required');
    }

    const today = todayIST();
    if (startDate < today) {
      throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'start_date cannot be in the past');
    }

    const allDates = eachDay(startDate, endDate);
    if (allDates.length > 62) {
      throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'Bulk date range cannot exceed 62 days');
    }

    const normalizedStatus = status === 'unavailable' ? 'blocked' : status;
    const provObjId = new mongoose.Types.ObjectId(providerId);

    // Find all days in range that have a booking
    const bookedDays = await ProviderAvailability.find({
      providerId: provObjId,
      date: { $in: allDates },
      bookingId: { $exists: true, $ne: null },
    }).lean();

    const bookedDateSet = new Set(bookedDays.map((b) => b.date));
    const skippedDates = allDates.filter((d) => bookedDateSet.has(d));
    const datesToUpdate = allDates.filter((d) => !bookedDateSet.has(d));

    if (normalizedStatus === 'available') {
      await ProviderAvailability.deleteMany({
        providerId: provObjId,
        date: { $in: datesToUpdate },
      });
    } else {
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
        await ProviderAvailability.bulkWrite(ops);
      }
    }

    const count = datesToUpdate.length;
    return respond.ok(
      req,
      res,
      {
        updatedCount: count,
        skippedDates,
      },
      {
        message: `${count} dates updated to ${normalizedStatus}`,
      }
    );
  },
};
