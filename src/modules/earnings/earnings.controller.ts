import { Request, Response } from 'express';
import mongoose from 'mongoose';
import dayjs from 'dayjs';
import { Booking } from '@/models/Booking';
import { Payout } from '@/models/Payout';
import { env } from '@/config/env';
import { nowIST } from '@/common/utils/dates';
import { parsePagination } from '@/common/http/pagination';
import { respond } from '@/common/http/respond';

function getNextTuesday(): string {
  const now = nowIST();
  let day = now;
  // Day of week: 0 is Sunday, 2 is Tuesday
  while (day.day() !== 2 || day.isSame(now, 'day')) {
    day = day.add(1, 'day');
  }
  return day.format('YYYY-MM-DD');
}

export const earningsController = {
  // GET /providers/earnings/summary
  async getSummary(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    const provObjId = new mongoose.Types.ObjectId(providerId);

    const commissionFactor = 1 - env.PLATFORM_COMMISSION_PERCENT / 100;

    const bookings = await Booking.find({
      providerId: provObjId,
      status: { $ne: 'cancelled' },
    }).lean();

    const startOfMonth = nowIST().startOf('month').toDate();
    const endOfMonth = nowIST().endOf('month').toDate();

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
    const payouts = await Payout.find({
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

    return respond.ok(req, res, summary);
  },

  // GET /providers/earnings/transactions
  async getTransactions(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    const { page, limit, skip } = parsePagination(req.query);

    const provObjId = new mongoose.Types.ObjectId(providerId);

    const [payouts, total] = await Promise.all([
      Payout.find({ providerId: provObjId })
        .sort({ payoutDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Payout.countDocuments({ providerId: provObjId }),
    ]);

    const items = payouts.map((p) => ({
      id: p._id.toString(),
      payoutDate: p.payoutDate,
      amount: p.amount,
      status: p.status,
      payoutMethod: p.method,
      utrNumber: p.utrNumber || null,
    }));

    return respond.list(req, res, items, { page, limit, total });
  },
};
