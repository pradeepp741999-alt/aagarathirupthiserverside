import { Request, Response } from 'express';
import mongoose from 'mongoose';
import dayjs from 'dayjs';
import { Enquiry } from '@/models/Enquiry';
import { Provider } from '@/models/Provider';
import { Booking } from '@/models/Booking';
import { enquiriesService } from './enquiries.service';
import {
  toProviderEnquiryListItemDto,
  toProviderEnquiryDetailDto,
} from './enquiries.dto';
import {
  CANONICAL_TO_PROVIDER_STATUS,
  normalizeInputStatus,
} from './enquiries.statusMap';
import { crmSyncService } from '@/services/crm.sync.service';
import { notifyService } from '@/services/notify.service';
import { calendarService } from '@/services/calendar.service';
import { parsePagination } from '@/common/http/pagination';
import { formatINR } from '@/common/utils/money';
import { respond } from '@/common/http/respond';
import { AppError } from '@/common/errors/AppError';
import { ERROR_CODES } from '@/common/errors/errorCodes';

export const enquiriesProviderController = {
  // GET /enquiries (provider)
  async listEnquiries(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    const { status, search } = req.query;
    const { page, limit, skip } = parsePagination(req.query);

    const provObjId = new mongoose.Types.ObjectId(providerId);
    const query: Record<string, unknown> = { providerId: provObjId };

    if (status) {
      const statusList = (status as string).split(',').map((s) => s.trim().toLowerCase());
      const canonicalSet = new Set<string>();

      for (const s of statusList) {
        if (s === 'all') continue;
        if (s === 'pending') canonicalSet.add('submitted');
        else if (s === 'reviewing') canonicalSet.add('provider_reviewing');
        else {
          const c = normalizeInputStatus(s);
          if (c) canonicalSet.add(c);
        }
      }

      if (canonicalSet.size > 0) {
        query.status = { $in: Array.from(canonicalSet) };
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

    const [enquiries, total] = await Promise.all([
      Enquiry.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Enquiry.countDocuments(query),
    ]);

    const items = enquiries.map((e) => toProviderEnquiryListItemDto(e));
    return respond.list(req, res, items, { page, limit, total });
  },

  // GET /enquiries/counts (provider)
  async getCounts(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    const provObjId = new mongoose.Types.ObjectId(providerId);

    const enquiries = await Enquiry.find({ providerId: provObjId }).select('status').lean();

    const counts = {
      all: enquiries.length,
      pending: 0,
      reviewing: 0,
      quote_sent: 0,
      accepted: 0,
      cancelled: 0,
    };

    for (const e of enquiries) {
      if (e.status === 'submitted') counts.pending++;
      else if (e.status === 'provider_reviewing') counts.reviewing++;
      else if (e.status === 'quote_sent') counts.quote_sent++;
      else if (e.status === 'accepted') counts.accepted++;
      else if (e.status === 'cancelled' || e.status === 'rejected') counts.cancelled++;
    }

    return respond.ok(req, res, counts);
  },

  // GET /enquiries/:id (provider)
  async getEnquiryById(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    const { id } = req.params;

    const enquiry = await Enquiry.findOne({
      _id: id,
      providerId: new mongoose.Types.ObjectId(providerId),
    });

    if (!enquiry) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Enquiry not found');
    }

    // Side effect: if status === 'submitted', move to 'provider_reviewing'
    if (enquiry.status === 'submitted') {
      enquiry.status = 'provider_reviewing';
      enquiry.isNewLead = false;
      if (!enquiry.firstRespondedAt) {
        enquiry.firstRespondedAt = new Date();
      }
      enquiry.timeline.push({
        kind: 'status',
        status: 'provider_reviewing',
        author: 'provider',
        message: 'Provider viewed enquiry',
        at: new Date(),
      });
      await enquiry.save();
      await crmSyncService.recompute(enquiry.providerId, enquiry.customer.mobile);
    } else if (enquiry.isNewLead) {
      enquiry.isNewLead = false;
      await enquiry.save();
    }

    const dto = toProviderEnquiryDetailDto(enquiry);
    return respond.ok(req, res, dto);
  },

  // PATCH /enquiries/:id/status (provider)
  async updateStatus(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    const { id } = req.params;
    const { status: rawStatus, note } = req.body;

    if (!rawStatus) {
      throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'status is required');
    }

    const targetStatus = normalizeInputStatus(rawStatus);
    const enquiry = await Enquiry.findOne({
      _id: id,
      providerId: new mongoose.Types.ObjectId(providerId),
    });

    if (!enquiry) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Enquiry not found');
    }

    if (['completed', 'cancelled', 'rejected'].includes(enquiry.status)) {
      throw new AppError(
        409,
        ERROR_CODES.INVALID_STATUS_TRANSITION,
        `Cannot change status of enquiry in terminal state: ${enquiry.status}`
      );
    }

    let bookingId: string | undefined = undefined;

    if (targetStatus === 'confirmed') {
      const provider = await Provider.findById(providerId);
      const booking = await enquiriesService.confirmBookingFromEnquiry(enquiry, provider);
      bookingId = booking._id.toString();
    } else if (targetStatus === 'rejected') {
      if (!note || note.trim().length === 0) {
        throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'Reason/note is required when declining an enquiry');
      }
      enquiry.status = 'rejected';
      enquiry.rejectionReason = note.trim();
      enquiry.timeline.push({
        kind: 'status',
        status: 'rejected',
        author: 'provider',
        message: `Enquiry declined: ${note.trim()}`,
        at: new Date(),
      });
      await enquiry.save();
      await crmSyncService.recompute(enquiry.providerId, enquiry.customer.mobile);

      notifyService
        .createNotification({
          recipientRole: 'user',
          recipientId: enquiry.userId,
          type: 'enquiry_update',
          title: 'Enquiry declined',
          message: 'The provider is unable to accommodate this event booking',
          referenceType: 'enquiry',
          referenceId: enquiry._id,
        })
        .catch(() => {});
    } else if (targetStatus === 'cancelled') {
      enquiry.status = 'cancelled';
      enquiry.cancelledBy = 'provider';
      enquiry.cancelReason = note || 'Cancelled by provider';
      enquiry.timeline.push({
        kind: 'status',
        status: 'cancelled',
        author: 'provider',
        message: note ? `Cancelled by provider: ${note}` : 'Enquiry cancelled by provider',
        at: new Date(),
      });
      if (enquiry.bookingId) {
        await Booking.findByIdAndUpdate(enquiry.bookingId, {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancelledBy: 'provider',
        });
        await calendarService.freeDates(enquiry.providerId, enquiry.bookingId);
      }
      await enquiry.save();
      await crmSyncService.recompute(enquiry.providerId, enquiry.customer.mobile);

      notifyService
        .createNotification({
          recipientRole: 'user',
          recipientId: enquiry.userId,
          type: 'booking',
          title: 'Booking cancelled',
          message: 'Provider has cancelled this booking reservation',
          referenceType: 'enquiry',
          referenceId: enquiry._id,
        })
        .catch(() => {});
    } else if (targetStatus === 'accepted') {
      enquiry.status = 'accepted';
      enquiry.timeline.push({
        kind: 'status',
        status: 'accepted',
        author: 'provider',
        message: 'Quote marked accepted (customer agreement recorded)',
        at: new Date(),
      });
      await enquiry.save();
      await crmSyncService.recompute(enquiry.providerId, enquiry.customer.mobile);
    } else if (targetStatus === 'quote_sent') {
      if (!enquiry.quote) {
        throw new AppError(422, ERROR_CODES.QUOTE_REQUIRED, 'Please send a quote using POST /enquiries/:id/quote');
      }
      enquiry.status = 'quote_sent';
      await enquiry.save();
    } else {
      throw new AppError(409, ERROR_CODES.INVALID_STATUS_TRANSITION, `Invalid status transition to: ${targetStatus}`);
    }

    const providerStatus = CANONICAL_TO_PROVIDER_STATUS[enquiry.status] || enquiry.status;

    const resData: Record<string, unknown> = {
      id: enquiry._id.toString(),
      status: providerStatus,
      updatedAt: enquiry.updatedAt.toISOString(),
    };
    if (bookingId) {
      resData.bookingId = bookingId;
    }

    return respond.ok(req, res, resData);
  },

  // POST /enquiries/:id/quote (provider)
  async sendQuote(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    const { id } = req.params;
    const { quoteAmount, validUntil, inclusions, terms, message } = req.body;

    if (typeof quoteAmount !== 'number' || quoteAmount <= 0) {
      throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'quote_amount must be greater than 0');
    }

    const enquiry = await Enquiry.findOne({
      _id: id,
      providerId: new mongoose.Types.ObjectId(providerId),
    });

    if (!enquiry) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Enquiry not found');
    }

    if (['completed', 'cancelled', 'rejected'].includes(enquiry.status)) {
      throw new AppError(
        409,
        ERROR_CODES.INVALID_STATUS_TRANSITION,
        'Cannot send a quote for a completed or cancelled enquiry'
      );
    }

    enquiry.quote = {
      amount: quoteAmount,
      validUntil: validUntil || undefined,
      inclusions: Array.isArray(inclusions) ? inclusions : [],
      terms,
      message,
      sentAt: new Date(),
    };

    enquiry.status = 'quote_sent';
    if (!enquiry.firstRespondedAt) {
      enquiry.firstRespondedAt = new Date();
      // Update provider avgResponseMinutes
      const diffMinutes = Math.max(1, dayjs().diff(dayjs(enquiry.createdAt), 'minute'));
      const prov = await Provider.findById(providerId);
      if (prov) {
        prov.avgResponseMinutes = Math.round((prov.avgResponseMinutes + diffMinutes) / 2);
        await prov.save();
      }
    }

    enquiry.timeline.push({
      kind: 'status',
      status: 'quote_sent',
      author: 'provider',
      message: `Quote submitted: ${formatINR(quoteAmount)}`,
      at: new Date(),
    });

    await enquiry.save();
    await crmSyncService.recompute(enquiry.providerId, enquiry.customer.mobile);

    const provider = await Provider.findById(providerId).lean();

    notifyService
      .createNotification({
        recipientRole: 'user',
        recipientId: enquiry.userId,
        type: 'quote_received',
        title: 'Quote Received!',
        message: `${provider?.businessName || 'Provider'} sent a quote for ${formatINR(quoteAmount)}`,
        referenceType: 'enquiry',
        referenceId: enquiry._id,
      })
      .catch(() => {});

    return respond.ok(req, res, undefined, {
      message: 'Quote sent to customer and SMS notification dispatched',
    });
  },

  // POST /enquiries/:id/messages (provider)
  async appendMessage(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    const { id } = req.params;
    const { message } = req.body;

    if (!message || message.trim().length === 0) {
      throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'message cannot be empty');
    }

    const enquiry = await Enquiry.findOne({
      _id: id,
      providerId: new mongoose.Types.ObjectId(providerId),
    });

    if (!enquiry) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Enquiry not found');
    }

    const now = new Date();
    enquiry.timeline.push({
      kind: 'message',
      author: 'provider',
      message: message.trim(),
      at: now,
    });

    await enquiry.save();

    return respond.ok(req, res, {
      id: enquiry._id.toString(),
      createdAt: now.toISOString(),
    });
  },
};
