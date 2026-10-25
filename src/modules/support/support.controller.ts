import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { SupportTicket } from '@/models/SupportTicket';
import { nextCode } from '@/common/utils/counters';
import { respond } from '@/common/http/respond';
import { AppError } from '@/common/errors/AppError';
import { ERROR_CODES } from '@/common/errors/errorCodes';

export const supportController = {
  // POST /support/enquiry
  async createSupportEnquiry(req: Request, res: Response) {
    const role = req.auth?.role || req.appRole || 'user';
    const subjectId = req.auth?.sub || new mongoose.Types.ObjectId().toString();
    const { subject, message } = req.body;

    if (!subject || !message) {
      throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'subject and message are required');
    }

    const code = await nextCode('ticket');

    await SupportTicket.create({
      code,
      role,
      subjectId: new mongoose.Types.ObjectId(subjectId),
      source: 'support_enquiry',
      subject: subject.trim(),
      category: 'general',
      message: message.trim(),
      status: 'open',
      replies: [],
    });

    return respond.ok(req, res, undefined, {
      message: `Support enquiry logged. Ticket #${code} created.`,
    });
  },

  // POST /support/tickets
  async createTicket(req: Request, res: Response) {
    const role = req.auth?.role || req.appRole || 'user';
    const subjectId = req.auth?.sub || new mongoose.Types.ObjectId().toString();
    const { subject, category, message } = req.body;

    if (!subject || !message) {
      throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'subject and message are required');
    }

    const code = await nextCode('ticket');

    const ticket = await SupportTicket.create({
      code,
      role,
      subjectId: new mongoose.Types.ObjectId(subjectId),
      source: 'ticket',
      subject: subject.trim(),
      category: category || 'general',
      message: message.trim(),
      status: 'open',
      replies: [],
    });

    return respond.created(req, res, {
      ticketId: ticket.code,
      status: ticket.status,
      message: 'Support ticket created. Our team will contact you within 4 hours.',
    });
  },
};
