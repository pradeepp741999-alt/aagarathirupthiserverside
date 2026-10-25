import { Request, Response } from 'express';
import mongoose from 'mongoose';
import dayjs from 'dayjs';
import { Enquiry } from '@/models/Enquiry';
import { Booking } from '@/models/Booking';
import { todayIST, nowIST } from '@/common/utils/dates';
import { respond } from '@/common/http/respond';

export const dashboardController = {
  async getMetrics(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    const provObjId = new mongoose.Types.ObjectId(providerId);
    const today = todayIST();

    // 1. Enquiries metrics
    const enquiries = await Enquiry.find({ providerId: provObjId }).lean();

    let activeEnquiries = 0;
    let quotePending = 0;
    const ninetyDaysAgo = dayjs().subtract(90, 'day').toDate();

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

    const responseRatePercent =
      totalLast90 > 0 ? Math.round((answeredLast90 / totalLast90) * 100) : 100;

    // 2. Bookings metrics
    const bookings = await Booking.find({ providerId: provObjId }).lean();
    let upcomingBookings = 0;

    const startOfMonth = nowIST().startOf('month').toDate();
    const endOfMonth = nowIST().endOf('month').toDate();
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

    return respond.ok(req, res, metrics);
  },
};
