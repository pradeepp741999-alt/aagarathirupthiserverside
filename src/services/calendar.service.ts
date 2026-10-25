import mongoose from 'mongoose';
import dayjs from 'dayjs';
import { ProviderAvailability } from '@/models/ProviderAvailability';
import { Provider } from '@/models/Provider';
import { eachDay, todayIST } from '@/common/utils/dates';
import { AppError } from '@/common/errors/AppError';
import { ERROR_CODES } from '@/common/errors/errorCodes';

export interface RangeAvailabilityResult {
  isAvailable: boolean;
  blockedDates: string[];
  reasons: Record<string, 'booked' | 'blocked' | 'notice_period'>;
}

export const calendarService = {
  async checkRangeAvailability(
    providerId: string | mongoose.Types.ObjectId,
    startDate: string,
    endDate: string = startDate
  ): Promise<RangeAvailabilityResult> {
    const dates = eachDay(startDate, endDate);
    const provider = await Provider.findById(providerId).select('settings').lean();
    const noticeDays = provider?.settings?.advanceNoticeDays ?? 3;

    const today = todayIST();
    const minBookableDate = dayjs(today).add(noticeDays, 'day').format('YYYY-MM-DD');

    const blockedRecords = await ProviderAvailability.find({
      providerId: new mongoose.Types.ObjectId(providerId),
      date: { $in: dates },
    }).lean();

    const blockedMap = new Map<string, 'booked' | 'blocked'>();
    for (const rec of blockedRecords) {
      blockedMap.set(rec.date, rec.status);
    }

    const blockedDates: string[] = [];
    const reasons: Record<string, 'booked' | 'blocked' | 'notice_period'> = {};

    for (const d of dates) {
      if (blockedMap.has(d)) {
        const status = blockedMap.get(d)!;
        blockedDates.push(d);
        reasons[d] = status;
      } else if (d < minBookableDate) {
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

  async blockDates(
    providerId: string | mongoose.Types.ObjectId,
    dates: string[],
    bookingId?: mongoose.Types.ObjectId,
    note?: string,
    session?: mongoose.ClientSession
  ): Promise<void> {
    const existingBooked = await ProviderAvailability.find({
      providerId: new mongoose.Types.ObjectId(providerId),
      date: { $in: dates },
    }).session(session || null);

    if (existingBooked.length > 0) {
      const conflictDates = existingBooked.map((b) => b.date);
      throw new AppError(
        409,
        ERROR_CODES.DATE_ALREADY_BOOKED,
        `Selected date(s) are already booked or blocked: ${conflictDates.join(', ')}`
      );
    }

    const docs = dates.map((date) => ({
      providerId: new mongoose.Types.ObjectId(providerId),
      date,
      status: 'booked' as const,
      bookingId,
      note,
    }));

    await ProviderAvailability.insertMany(docs, { session });
  },

  async freeDates(
    providerId: string | mongoose.Types.ObjectId,
    bookingId: mongoose.Types.ObjectId,
    session?: mongoose.ClientSession
  ): Promise<void> {
    await ProviderAvailability.deleteMany(
      {
        providerId: new mongoose.Types.ObjectId(providerId),
        bookingId,
      },
      { session }
    );
  },

  async getMonthCalendar(
    providerId: string | mongoose.Types.ObjectId,
    year: number,
    month: number
  ) {
    const startOfMonth = dayjs(`${year}-${String(month).padStart(2, '0')}-01`);
    const endOfMonth = startOfMonth.endOf('month');
    const allDays = eachDay(startOfMonth.format('YYYY-MM-DD'), endOfMonth.format('YYYY-MM-DD'));

    const storedDays = await ProviderAvailability.find({
      providerId: new mongoose.Types.ObjectId(providerId),
      date: { $in: allDays },
    }).lean();

    const map = new Map<string, { status: string; note?: string; bookingId?: string }>();
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

      if (status === 'booked') bookedCount++;
      else if (status === 'blocked') blockedCount++;
      else availableCount++;

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
