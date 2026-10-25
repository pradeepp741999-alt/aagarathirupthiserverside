import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Booking } from '@/models/Booking';
import { Enquiry } from '@/models/Enquiry';
import { Provider } from '@/models/Provider';
import { generateInvoicePdf } from '@/services/pdf/invoice';
import { calendarService } from '@/services/calendar.service';
import { crmSyncService } from '@/services/crm.sync.service';
import { notifyService } from '@/services/notify.service';
import { nextCode } from '@/common/utils/counters';
import { todayIST, formatDisplayDate } from '@/common/utils/dates';
import { parsePagination } from '@/common/http/pagination';
import { respond } from '@/common/http/respond';
import { AppError } from '@/common/errors/AppError';
import { ERROR_CODES } from '@/common/errors/errorCodes';

export const bookingsController = {
  // GET /bookings
  async listBookings(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    const { status, search } = req.query;
    const { page, limit, skip } = parsePagination(req.query);

    const provObjId = new mongoose.Types.ObjectId(providerId);
    const query: Record<string, unknown> = { providerId: provObjId };
    const today = todayIST();

    if (status) {
      const s = (status as string).toLowerCase();
      if (s === 'upcoming') {
        query.status = 'confirmed';
        query.eventDate = { $gte: today };
      } else if (['confirmed', 'in_progress', 'completed', 'cancelled'].includes(s)) {
        query.status = s;
      }
    }

    if (search) {
      const reg = new RegExp((search as string).trim(), 'i');
      query.$or = [
        { code: reg },
        { eventType: reg },
        { 'customer.name': reg },
        { 'customer.mobile': reg },
      ];
    }

    const sortOrder: Record<string, 1 | -1> =
      status === 'upcoming' || query.status === 'confirmed'
        ? { eventDate: 1 }
        : { eventDate: -1 };

    const [bookings, total] = await Promise.all([
      Booking.find(query).sort(sortOrder).skip(skip).limit(limit).lean(),
      Booking.countDocuments(query),
    ]);

    const items = bookings.map((b) => ({
      id: b._id.toString(),
      code: b.code,
      customerName: b.customer?.name || 'Customer',
      customerMobile: b.customer?.mobile ? `+91 ${b.customer.mobile}` : '',
      eventType: b.eventType,
      eventDate: b.eventDate,
      eventEndDate: b.eventEndDate || null,
      venue: b.venue,
      location: b.venue,
      totalAmount: b.totalAmount,
      advancePaid: b.advancePaid || 0,
      balanceDue: b.balanceDue || 0,
      paymentStatus: b.paymentStatus,
      status: b.status,
    }));

    return respond.list(req, res, items, { page, limit, total });
  },

  // GET /bookings/counts
  async getCounts(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    const provObjId = new mongoose.Types.ObjectId(providerId);
    const today = todayIST();

    const bookings = await Booking.find({ providerId: provObjId }).select('status eventDate').lean();

    const counts = {
      all: bookings.length,
      upcoming: 0,
      inProgress: 0,
      completed: 0,
      cancelled: 0,
    };

    for (const b of bookings) {
      if (b.status === 'confirmed' && b.eventDate >= today) {
        counts.upcoming++;
      } else if (b.status === 'in_progress') {
        counts.inProgress++;
      } else if (b.status === 'completed') {
        counts.completed++;
      } else if (b.status === 'cancelled') {
        counts.cancelled++;
      }
    }

    return respond.ok(req, res, counts);
  },

  // GET /bookings/:id
  async getBookingById(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    const { id } = req.params;

    const booking = await Booking.findOne({
      _id: id,
      providerId: new mongoose.Types.ObjectId(providerId),
    }).lean();

    if (!booking) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Booking not found');
    }

    const enquiry = await Enquiry.findById(booking.enquiryId).lean();

    const detail = {
      id: booking._id.toString(),
      code: booking.code,
      enquiryId: booking.enquiryId.toString(),
      customer: {
        name: booking.customer.name,
        mobile: `+91 ${booking.customer.mobile}`,
        email: booking.customer.email || null,
      },
      eventDetails: {
        type: booking.eventType,
        date: booking.eventDate,
        endDate: booking.eventEndDate || null,
        startTime: booking.startTime || null,
        venue: booking.venue,
        guestCount: booking.guestCount,
      },
      billing: {
        totalAmount: booking.totalAmount,
        advancePaid: booking.advancePaid || 0,
        balanceAmount: booking.balanceDue || 0,
        balanceDue: booking.balanceDue || 0,
        paymentStatus: booking.paymentStatus,
      },
      paymentsHistory: (booking.payments || []).map((p: any) => ({
        id: p._id?.toString() || p.receiptNo,
        amount: p.amount,
        method: p.method,
        date: p.paidAt ? new Date(p.paidAt).toISOString() : new Date().toISOString(),
        receiptNo: p.receiptNo,
      })),
      items: (enquiry?.items || []).map((it: any) => ({
        name: it.name,
        price: it.price,
        quantity: it.qty,
        total: it.price * it.qty,
      })),
      status: booking.status,
    };

    return respond.ok(req, res, detail);
  },

  // PATCH /bookings/:id/status
  async updateStatus(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    const { id } = req.params;
    const { status: targetStatus } = req.body;

    if (!targetStatus) {
      throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'status is required');
    }

    const booking = await Booking.findOne({
      _id: id,
      providerId: new mongoose.Types.ObjectId(providerId),
    });

    if (!booking) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Booking not found');
    }

    if (booking.status === 'completed' || booking.status === 'cancelled') {
      throw new AppError(
        409,
        ERROR_CODES.INVALID_STATUS_TRANSITION,
        `Cannot change status of booking in terminal state: ${booking.status}`
      );
    }

    const today = todayIST();
    const provider = await Provider.findById(providerId).lean();

    if (targetStatus === 'in_progress') {
      if (booking.status !== 'confirmed') {
        throw new AppError(409, ERROR_CODES.INVALID_STATUS_TRANSITION, 'Only confirmed bookings can move to in_progress');
      }
      booking.status = 'in_progress';
    } else if (targetStatus === 'completed') {
      if (booking.eventDate > today) {
        throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'Cannot mark booking as completed before event date');
      }
      booking.status = 'completed';
      booking.completedAt = new Date();

      await Enquiry.findByIdAndUpdate(booking.enquiryId, {
        status: 'completed',
        $push: {
          timeline: {
            kind: 'status',
            status: 'completed',
            author: 'provider',
            message: 'Event marked as completed by provider',
            at: new Date(),
          },
        },
      });

      notifyService
        .createNotification({
          recipientRole: 'user',
          recipientId: booking.userId,
          type: 'booking',
          title: `How was ${provider?.businessName || 'the service'}?`,
          message: 'Rate your experience and share a review',
          referenceType: 'enquiry',
          referenceId: booking.enquiryId,
        })
        .catch(() => {});
    } else if (targetStatus === 'cancelled') {
      booking.status = 'cancelled';
      booking.cancelledAt = new Date();
      booking.cancelledBy = 'provider';

      await calendarService.freeDates(booking.providerId, booking._id as mongoose.Types.ObjectId);

      await Enquiry.findByIdAndUpdate(booking.enquiryId, {
        status: 'cancelled',
        cancelledBy: 'provider',
        cancelReason: 'Booking cancelled by provider',
        $push: {
          timeline: {
            kind: 'status',
            status: 'cancelled',
            author: 'provider',
            message: 'Booking cancelled by provider',
            at: new Date(),
          },
        },
      });

      notifyService
        .createNotification({
          recipientRole: 'user',
          recipientId: booking.userId,
          type: 'booking',
          title: 'Booking cancelled',
          message: `${provider?.businessName || 'Provider'} has cancelled your booking`,
          referenceType: 'enquiry',
          referenceId: booking.enquiryId,
        })
        .catch(() => {});
    } else {
      throw new AppError(409, ERROR_CODES.INVALID_STATUS_TRANSITION, `Invalid booking target status: ${targetStatus}`);
    }

    await booking.save();
    await crmSyncService.recompute(booking.providerId, booking.customer.mobile);

    return respond.ok(req, res, { id: booking._id.toString(), status: booking.status });
  },

  // POST /bookings/:id/payments
  async recordPayment(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    const { id } = req.params;
    const { amount, paymentMethod, payment_method, referenceId, reference_id, notes } = req.body;

    const method = paymentMethod || payment_method;
    const refId = referenceId || reference_id;

    if (typeof amount !== 'number' || amount <= 0) {
      throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'amount must be greater than 0');
    }
    if (!['upi', 'cash', 'bank_transfer'].includes(method)) {
      throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, "payment_method must be 'upi', 'cash', or 'bank_transfer'");
    }

    const booking = await Booking.findOne({
      _id: id,
      providerId: new mongoose.Types.ObjectId(providerId),
    });

    if (!booking) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Booking not found');
    }

    if (booking.status === 'cancelled') {
      throw new AppError(409, ERROR_CODES.INVALID_STATUS_TRANSITION, 'Cannot record payment for a cancelled booking');
    }

    if (amount > booking.balanceDue) {
      throw new AppError(
        422,
        ERROR_CODES.PAYMENT_EXCEEDS_BALANCE,
        `Payment amount (₹${amount}) cannot exceed outstanding balance due (₹${booking.balanceDue})`
      );
    }

    const receiptNo = await nextCode('receipt');
    booking.payments.push({
      amount,
      method,
      referenceId: refId,
      notes,
      receiptNo,
      paidAt: new Date(),
    });

    const totalPaid = booking.payments.reduce((sum, p) => sum + p.amount, 0);
    booking.advancePaid = totalPaid;
    booking.balanceDue = booking.totalAmount - totalPaid;

    if (booking.balanceDue === 0) {
      booking.paymentStatus = 'paid';
    } else if (totalPaid > 0) {
      booking.paymentStatus = 'partially_paid';
    } else {
      booking.paymentStatus = 'unpaid';
    }

    booking.invoiceUrl = undefined; // Invalidate cached invoice
    await booking.save();

    await crmSyncService.recompute(booking.providerId, booking.customer.mobile);

    const data = {
      balanceDue: booking.balanceDue,
      receiptNo,
      paymentStatus: booking.paymentStatus,
    };

    return respond.ok(req, res, data, {
      message: 'Payment recorded successfully',
      extraTopLevel: { balance_due: booking.balanceDue },
    });
  },

  // GET /bookings/:id/invoice
  async getInvoice(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    const { id } = req.params;

    const booking = await Booking.findOne({
      _id: id,
      providerId: new mongoose.Types.ObjectId(providerId),
    });

    if (!booking) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Booking not found');
    }

    const provider = await Provider.findById(providerId);
    if (!provider) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Provider not found');
    }

    const pdfUrl = await generateInvoicePdf(booking, provider);
    booking.invoiceUrl = pdfUrl;
    await booking.save();

    return respond.ok(req, res, { pdfUrl });
  },
};
