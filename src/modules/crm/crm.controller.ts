import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { CrmCustomer } from '@/models/CrmCustomer';
import { Booking } from '@/models/Booking';
import { Enquiry } from '@/models/Enquiry';
import { parsePagination } from '@/common/http/pagination';
import { respond } from '@/common/http/respond';
import { AppError } from '@/common/errors/AppError';
import { ERROR_CODES } from '@/common/errors/errorCodes';

export const crmController = {
  // GET /crm/customers
  async listCustomers(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    const { search, tag } = req.query;
    const { page, limit, skip } = parsePagination(req.query);

    const provObjId = new mongoose.Types.ObjectId(providerId);
    const query: Record<string, unknown> = { providerId: provObjId };

    if (tag) {
      query.tags = tag;
    }

    if (search) {
      const reg = new RegExp((search as string).trim(), 'i');
      query.$or = [{ name: reg }, { mobile: reg }];
    }

    const [customers, total] = await Promise.all([
      CrmCustomer.find(query).sort({ lastContactAt: -1 }).skip(skip).limit(limit).lean(),
      CrmCustomer.countDocuments(query),
    ]);

    const items = customers.map((c) => ({
      id: c._id.toString(),
      name: c.name || 'Customer',
      mobile: `+91 ${c.mobile}`,
      city: c.city || c.district || '',
      totalBookings: c.totalBookings || 0,
      totalSpent: c.totalSpent || 0,
      lastEventDate: c.lastEventDate || null,
      tags: c.tags || [],
      stage: c.stage,
      avatarColor: c.avatarColor || '#8B5CF6',
      lastContactAt: c.lastContactAt.toISOString(),
    }));

    return respond.list(req, res, items, { page, limit, total });
  },

  // GET /crm/stats
  async getStats(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    const provObjId = new mongoose.Types.ObjectId(providerId);

    const customers = await CrmCustomer.find({ providerId: provObjId }).lean();
    const totalCustomers = customers.length;

    if (totalCustomers === 0) {
      return respond.ok(req, res, {
        totalCustomers: 0,
        repeatClients: 0,
        repeatRatePercent: 0,
        avgLifetimeValue: 0,
      });
    }

    let repeatClients = 0;
    let totalSpentByBooked = 0;
    let bookedClientsCount = 0;

    for (const c of customers) {
      if ((c.totalBookings || 0) >= 2) {
        repeatClients++;
      }
      if ((c.totalBookings || 0) >= 1) {
        bookedClientsCount++;
        totalSpentByBooked += c.totalSpent || 0;
      }
    }

    const repeatRatePercent = Math.round((repeatClients / totalCustomers) * 1000) / 10;
    const avgLifetimeValue = bookedClientsCount > 0 ? Math.round(totalSpentByBooked / bookedClientsCount) : 0;

    return respond.ok(req, res, {
      totalCustomers,
      repeatClients,
      repeatRatePercent,
      avgLifetimeValue,
    });
  },

  // GET /crm/customers/:id
  async getCustomerById(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    const { id } = req.params;

    const customer = await CrmCustomer.findOne({
      _id: id,
      providerId: new mongoose.Types.ObjectId(providerId),
    }).lean();

    if (!customer) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'CRM Customer not found');
    }

    return respond.ok(req, res, {
      id: customer._id.toString(),
      name: customer.name || 'Customer',
      mobile: `+91 ${customer.mobile}`,
      whatsapp: customer.whatsapp ? `+91 ${customer.whatsapp}` : null,
      email: customer.email || null,
      district: customer.district || customer.city || null,
      totalBookings: customer.totalBookings || 0,
      totalSpent: customer.totalSpent || 0,
      stage: customer.stage,
      tags: customer.tags || [],
      avatarColor: customer.avatarColor || '#8B5CF6',
    });
  },

  // GET /crm/customers/:id/history
  async getCustomerHistory(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    const { id } = req.params;

    const customer = await CrmCustomer.findOne({
      _id: id,
      providerId: new mongoose.Types.ObjectId(providerId),
    }).lean();

    if (!customer) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'CRM Customer not found');
    }

    const [bookings, enquiries] = await Promise.all([
      Booking.find({
        providerId: customer.providerId,
        'customer.mobile': customer.mobile,
      })
        .sort({ eventDate: -1 })
        .lean(),
      Enquiry.find({
        providerId: customer.providerId,
        'customer.mobile': customer.mobile,
      })
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const convertedEnquiryIds = new Set(bookings.map((b) => b.enquiryId.toString()));

    const historyItems: any[] = [];

    for (const b of bookings) {
      historyItems.push({
        type: 'booking',
        id: b._id.toString(),
        event: b.eventType,
        date: b.eventDate,
        amount: b.totalAmount,
        status: b.status,
      });
    }

    for (const e of enquiries) {
      if (!convertedEnquiryIds.has(e._id.toString())) {
        historyItems.push({
          type: 'enquiry',
          id: e._id.toString(),
          event: e.eventType,
          date: e.eventDate,
          amount: e.quote?.amount || e.estimatedTotal,
          status: e.status,
        });
      }
    }

    historyItems.sort((a, b) => (a.date > b.date ? -1 : 1));

    return respond.ok(req, res, historyItems);
  },

  // GET /crm/customers/:id/notes
  async getCustomerNotes(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    const { id } = req.params;

    const customer = await CrmCustomer.findOne({
      _id: id,
      providerId: new mongoose.Types.ObjectId(providerId),
    }).lean();

    if (!customer) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'CRM Customer not found');
    }

    const notes = (customer.notes || []).map((n) => ({
      id: n._id ? n._id.toString() : new mongoose.Types.ObjectId().toString(),
      note: n.note,
      createdAt: n.createdAt ? new Date(n.createdAt).toISOString() : new Date().toISOString(),
    }));

    notes.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));

    return respond.ok(req, res, notes);
  },

  // POST /crm/customers/:id/notes
  async addCustomerNote(req: Request, res: Response) {
    const providerId = req.auth!.sub;
    const { id } = req.params;
    const { note } = req.body;

    if (!note || note.trim().length === 0 || note.trim().length > 1000) {
      throw new AppError(422, ERROR_CODES.VALIDATION_ERROR, 'note must be between 1 and 1000 characters');
    }

    const customer = await CrmCustomer.findOne({
      _id: id,
      providerId: new mongoose.Types.ObjectId(providerId),
    });

    if (!customer) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'CRM Customer not found');
    }

    const newNote = {
      _id: new mongoose.Types.ObjectId(),
      note: note.trim(),
      createdAt: new Date(),
    };

    customer.notes.push(newNote);
    customer.lastContactAt = new Date();
    await customer.save();

    return respond.ok(req, res, {
      id: newNote._id.toString(),
      createdAt: newNote.createdAt.toISOString(),
    });
  },
};
