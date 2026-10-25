import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Enquiry } from '@/models/Enquiry';
import { Provider } from '@/models/Provider';
import { Booking } from '@/models/Booking';
import { enquiriesService } from './enquiries.service';
import { toUserEnquiryDto } from './enquiries.dto';
import { normalizeInputStatus } from './enquiries.statusMap';
import { crmSyncService } from '@/services/crm.sync.service';
import { notifyService } from '@/services/notify.service';
import { calendarService } from '@/services/calendar.service';
import { ymd } from '@/common/utils/dates';
import { AppError } from '@/common/errors/AppError';
import { ERROR_CODES } from '@/common/errors/errorCodes';

export const enquiriesUserController = {
  // POST /enquiries (user)
  async createEnquiry(req: Request, res: Response) {
    const userId = req.auth!.sub;
    const enquiry = await enquiriesService.submitEnquiry(userId, req.body);

    // User doc format: { id, code, status: 'submitted', createdAt: 'YYYY-MM-DD' }
    return res.status(201).json({
      id: enquiry._id.toString(),
      code: enquiry.code,
      status: 'submitted',
      createdAt: ymd(enquiry.createdAt),
    });
  },

  // GET /enquiries (user)
  async listEnquiries(req: Request, res: Response) {
    const userId = req.auth!.sub;
    const { status } = req.query;

    const query: Record<string, unknown> = {
      userId: new mongoose.Types.ObjectId(userId),
    };

    if (status) {
      const canonical = normalizeInputStatus(status as string);
      if (canonical) {
        query.status = canonical;
      }
    }

    const enquiries = await Enquiry.find(query)
      .sort({ createdAt: -1 })
      .populate('providerId', 'businessName mobile whatsapp rating reviewCount verified coverImage avgResponseMinutes')
      .lean();

    const dtos = enquiries.map((e) => toUserEnquiryDto(e, e.providerId));
    return res.status(200).json(dtos);
  },

  // GET /enquiries/summary (user)
  async getSummary(req: Request, res: Response) {
    const userId = req.auth!.sub;
    const enquiries = await Enquiry.find({
      userId: new mongoose.Types.ObjectId(userId),
    }).lean();

    const activeCount = enquiries.filter((e) =>
      ['submitted', 'provider_reviewing', 'quote_sent', 'accepted', 'confirmed'].includes(e.status)
    ).length;

    const awaitingResponseCount = enquiries.filter((e) => e.status === 'quote_sent').length;

    return res.status(200).json({
      activeCount,
      awaitingResponseCount,
    });
  },

  // GET /enquiries/:id (user)
  async getEnquiryById(req: Request, res: Response) {
    const userId = req.auth!.sub;
    const { id } = req.params;

    const enquiry = await Enquiry.findOne({
      _id: id,
      userId: new mongoose.Types.ObjectId(userId),
    })
      .populate('providerId', 'businessName mobile whatsapp rating reviewCount verified coverImage avgResponseMinutes')
      .lean();

    if (!enquiry) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Enquiry not found');
    }

    const dto = toUserEnquiryDto(enquiry, enquiry.providerId);
    return res.status(200).json(dto);
  },

  // PATCH /enquiries/:id/status (user)
  async updateStatus(req: Request, res: Response) {
    const userId = req.auth!.sub;
    const { id } = req.params;
    const { status: rawStatus, reason } = req.body;

    if (!rawStatus) {
      throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'status is required');
    }

    const targetStatus = normalizeInputStatus(rawStatus);
    if (!targetStatus || !['accepted', 'cancelled'].includes(targetStatus)) {
      throw new AppError(
        400,
        ERROR_CODES.INVALID_STATUS_TRANSITION,
        "Customer may only update enquiry status to 'accepted' or 'cancelled'"
      );
    }

    const enquiry = await Enquiry.findOne({
      _id: id,
      userId: new mongoose.Types.ObjectId(userId),
    });

    if (!enquiry) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Enquiry not found');
    }

    if (['completed', 'cancelled', 'rejected'].includes(enquiry.status)) {
      throw new AppError(
        409,
        ERROR_CODES.INVALID_STATUS_TRANSITION,
        `Cannot change status of an enquiry in terminal state: ${enquiry.status}`
      );
    }

    const provider = await Provider.findById(enquiry.providerId).lean();

    if (targetStatus === 'accepted') {
      if (enquiry.status !== 'quote_sent') {
        throw new AppError(
          409,
          ERROR_CODES.INVALID_STATUS_TRANSITION,
          'Quote must be received before accepting'
        );
      }
      enquiry.status = 'accepted';
      enquiry.timeline.push({
        kind: 'status',
        status: 'accepted',
        author: 'customer',
        message: 'Customer accepted the quote',
        at: new Date(),
      });

      notifyService
        .createNotification({
          recipientRole: 'provider',
          recipientId: enquiry.providerId,
          type: 'enquiry_update',
          title: 'Quote accepted',
          message: `${enquiry.customer.name || 'Customer'} accepted your quote`,
          referenceType: 'enquiry',
          referenceId: enquiry._id,
        })
        .catch(() => {});
    } else if (targetStatus === 'cancelled') {
      enquiry.status = 'cancelled';
      enquiry.cancelledBy = 'customer';
      enquiry.cancelReason = reason || 'Cancelled by customer';
      enquiry.timeline.push({
        kind: 'status',
        status: 'cancelled',
        author: 'customer',
        message: reason ? `Cancelled by customer: ${reason}` : 'Enquiry cancelled by customer',
        at: new Date(),
      });

      // If booking was created, cancel it too
      if (enquiry.bookingId) {
        await Booking.findByIdAndUpdate(enquiry.bookingId, {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancelledBy: 'customer',
        });
        await calendarService.freeDates(enquiry.providerId, enquiry.bookingId);
      }

      notifyService
        .createNotification({
          recipientRole: 'provider',
          recipientId: enquiry.providerId,
          type: 'enquiry_update',
          title: 'Enquiry cancelled',
          message: `${enquiry.customer.name || 'Customer'} cancelled their enquiry`,
          referenceType: 'enquiry',
          referenceId: enquiry._id,
        })
        .catch(() => {});
    }

    await enquiry.save();
    await crmSyncService.recompute(enquiry.providerId, enquiry.customer.mobile);

    const updatedDto = toUserEnquiryDto(enquiry, provider);
    return res.status(200).json(updatedDto);
  },
};
