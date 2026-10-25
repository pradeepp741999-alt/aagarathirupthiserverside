import { Request, Response } from 'express';
import mongoose from 'mongoose';
import dayjs from 'dayjs';
import { Booking } from '@/models/Booking';
import { Enquiry } from '@/models/Enquiry';
import { Provider } from '@/models/Provider';
import { exportAnalyticsPdf, exportAnalyticsCsv } from '@/services/pdf/report';
import { nowIST } from '@/common/utils/dates';
import { respond } from '@/common/http/respond';
import { AppError } from '@/common/errors/AppError';
import { ERROR_CODES } from '@/common/errors/errorCodes';

function getPeriodDateRange(period: string = 'this_month') {
  const now = nowIST();
  let startDate = now.startOf('month').format('YYYY-MM-DD');
  let endDate = now.endOf('month').format('YYYY-MM-DD');

  if (period === 'last_3_months') {
    startDate = now.subtract(2, 'month').startOf('month').format('YYYY-MM-DD');
    endDate = now.endOf('month').format('YYYY-MM-DD');
  } else if (period === 'this_year') {
    startDate = now.startOf('year').format('YYYY-MM-DD');
    endDate = now.endOf('year').format('YYYY-MM-DD');
  }

  return { startDate, endDate };
}

export const analyticsController = {
  // GET /analytics/overview
  async getOverview(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    const period = (req.query.period as string) || 'this_month';
    const { startDate, endDate } = getPeriodDateRange(period);

    const provObjId = new mongoose.Types.ObjectId(providerId);

    const completedBookings = await Booking.find({
      providerId: provObjId,
      status: 'completed',
      eventDate: { $gte: startDate, $lte: endDate },
    }).lean();

    const totalRevenue = completedBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
    const completedEvents = completedBookings.length;
    const totalGuestsServed = completedBookings.reduce((sum, b) => sum + (b.guestCount || 0), 0);
    const avgEventValue = completedEvents > 0 ? Math.round(totalRevenue / completedEvents) : 0;

    const startDateTime = dayjs(startDate).startOf('day').toDate();
    const endDateTime = dayjs(endDate).endOf('day').toDate();

    const enquiries = await Enquiry.find({
      providerId: provObjId,
      createdAt: { $gte: startDateTime, $lte: endDateTime },
    }).lean();

    const totalEnquiries = enquiries.length;
    const converted = enquiries.filter(
      (e) => e.status === 'confirmed' || e.status === 'completed' || e.bookingId
    ).length;

    const conversionRatePercent =
      totalEnquiries > 0 ? Math.round((converted / totalEnquiries) * 1000) / 10 : 0;

    return respond.ok(req, res, {
      totalRevenue,
      completedEvents,
      totalGuestsServed,
      conversionRatePercent,
      avgEventValue,
    });
  },

  // GET /analytics/revenue-chart
  async getRevenueChart(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    const year = parseInt(req.query.year as string, 10) || nowIST().year();

    const provObjId = new mongoose.Types.ObjectId(providerId);

    const startYear = `${year}-01-01`;
    const endYear = `${year}-12-31`;

    const completedBookings = await Booking.find({
      providerId: provObjId,
      status: 'completed',
      eventDate: { $gte: startYear, $lte: endYear },
    }).lean();

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentYear = nowIST().year();
    const currentMonthIdx = nowIST().month(); // 0-indexed

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

    return respond.ok(req, res, chartData);
  },

  // GET /analytics/export
  async exportAnalytics(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    const format = ((req.query.format as string) || 'pdf').toLowerCase();
    const period = (req.query.period as string) || 'this_month';

    const provider = await Provider.findById(providerId);
    if (!provider) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Provider not found');
    }

    const { startDate, endDate } = getPeriodDateRange(period);
    const provObjId = new mongoose.Types.ObjectId(providerId);

    const completedBookings = await Booking.find({
      providerId: provObjId,
      status: 'completed',
      eventDate: { $gte: startDate, $lte: endDate },
    }).lean();

    const totalRevenue = completedBookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
    const completedEvents = completedBookings.length;
    const totalGuestsServed = completedBookings.reduce((sum, b) => sum + (b.guestCount || 0), 0);
    const avgEventValue = completedEvents > 0 ? Math.round(totalRevenue / completedEvents) : 0;

    const startDateTime = dayjs(startDate).startOf('day').toDate();
    const endDateTime = dayjs(endDate).endOf('day').toDate();

    const totalEnquiries = await Enquiry.countDocuments({
      providerId: provObjId,
      createdAt: { $gte: startDateTime, $lte: endDateTime },
    });

    const converted = await Enquiry.countDocuments({
      providerId: provObjId,
      createdAt: { $gte: startDateTime, $lte: endDateTime },
      status: { $in: ['confirmed', 'completed'] },
    });

    const conversionRatePercent =
      totalEnquiries > 0 ? Math.round((converted / totalEnquiries) * 1000) / 10 : 0;

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
      downloadUrl = await exportAnalyticsCsv(provider, exportData);
    } else {
      downloadUrl = await exportAnalyticsPdf(provider, exportData);
    }

    return respond.ok(req, res, { downloadUrl });
  },
};
