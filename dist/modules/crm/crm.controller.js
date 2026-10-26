"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.crmController = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const CrmCustomer_1 = require("@/models/CrmCustomer");
const Booking_1 = require("@/models/Booking");
const Enquiry_1 = require("@/models/Enquiry");
const pagination_1 = require("@/common/http/pagination");
const respond_1 = require("@/common/http/respond");
const AppError_1 = require("@/common/errors/AppError");
const errorCodes_1 = require("@/common/errors/errorCodes");
exports.crmController = {
    // GET /crm/customers
    async listCustomers(req, res) {
        const providerId = req.auth.sub;
        const { search, tag } = req.query;
        const { page, limit, skip } = (0, pagination_1.parsePagination)(req.query);
        const provObjId = new mongoose_1.default.Types.ObjectId(providerId);
        const query = { providerId: provObjId };
        if (tag) {
            query.tags = tag;
        }
        if (search) {
            const reg = new RegExp(search.trim(), 'i');
            query.$or = [{ name: reg }, { mobile: reg }];
        }
        const [customers, total] = await Promise.all([
            CrmCustomer_1.CrmCustomer.find(query).sort({ lastContactAt: -1 }).skip(skip).limit(limit).lean(),
            CrmCustomer_1.CrmCustomer.countDocuments(query),
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
        return respond_1.respond.list(req, res, items, { page, limit, total });
    },
    // GET /crm/stats
    async getStats(req, res) {
        const providerId = req.auth.sub;
        const provObjId = new mongoose_1.default.Types.ObjectId(providerId);
        const customers = await CrmCustomer_1.CrmCustomer.find({ providerId: provObjId }).lean();
        const totalCustomers = customers.length;
        if (totalCustomers === 0) {
            return respond_1.respond.ok(req, res, {
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
        return respond_1.respond.ok(req, res, {
            totalCustomers,
            repeatClients,
            repeatRatePercent,
            avgLifetimeValue,
        });
    },
    // GET /crm/customers/:id
    async getCustomerById(req, res) {
        const providerId = req.auth.sub;
        const { id } = req.params;
        const customer = await CrmCustomer_1.CrmCustomer.findOne({
            _id: id,
            providerId: new mongoose_1.default.Types.ObjectId(providerId),
        }).lean();
        if (!customer) {
            throw new AppError_1.AppError(404, errorCodes_1.ERROR_CODES.NOT_FOUND, 'CRM Customer not found');
        }
        return respond_1.respond.ok(req, res, {
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
    async getCustomerHistory(req, res) {
        const providerId = req.auth.sub;
        const { id } = req.params;
        const customer = await CrmCustomer_1.CrmCustomer.findOne({
            _id: id,
            providerId: new mongoose_1.default.Types.ObjectId(providerId),
        }).lean();
        if (!customer) {
            throw new AppError_1.AppError(404, errorCodes_1.ERROR_CODES.NOT_FOUND, 'CRM Customer not found');
        }
        const [bookings, enquiries] = await Promise.all([
            Booking_1.Booking.find({
                providerId: customer.providerId,
                'customer.mobile': customer.mobile,
            })
                .sort({ eventDate: -1 })
                .lean(),
            Enquiry_1.Enquiry.find({
                providerId: customer.providerId,
                'customer.mobile': customer.mobile,
            })
                .sort({ createdAt: -1 })
                .lean(),
        ]);
        const convertedEnquiryIds = new Set(bookings.map((b) => b.enquiryId.toString()));
        const historyItems = [];
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
        return respond_1.respond.ok(req, res, historyItems);
    },
    // GET /crm/customers/:id/notes
    async getCustomerNotes(req, res) {
        const providerId = req.auth.sub;
        const { id } = req.params;
        const customer = await CrmCustomer_1.CrmCustomer.findOne({
            _id: id,
            providerId: new mongoose_1.default.Types.ObjectId(providerId),
        }).lean();
        if (!customer) {
            throw new AppError_1.AppError(404, errorCodes_1.ERROR_CODES.NOT_FOUND, 'CRM Customer not found');
        }
        const notes = (customer.notes || []).map((n) => ({
            id: n._id ? n._id.toString() : new mongoose_1.default.Types.ObjectId().toString(),
            note: n.note,
            createdAt: n.createdAt ? new Date(n.createdAt).toISOString() : new Date().toISOString(),
        }));
        notes.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
        return respond_1.respond.ok(req, res, notes);
    },
    // POST /crm/customers/:id/notes
    async addCustomerNote(req, res) {
        const providerId = req.auth.sub;
        const { id } = req.params;
        const { note } = req.body;
        if (!note || note.trim().length === 0 || note.trim().length > 1000) {
            throw new AppError_1.AppError(422, errorCodes_1.ERROR_CODES.VALIDATION_ERROR, 'note must be between 1 and 1000 characters');
        }
        const customer = await CrmCustomer_1.CrmCustomer.findOne({
            _id: id,
            providerId: new mongoose_1.default.Types.ObjectId(providerId),
        });
        if (!customer) {
            throw new AppError_1.AppError(404, errorCodes_1.ERROR_CODES.NOT_FOUND, 'CRM Customer not found');
        }
        const newNote = {
            _id: new mongoose_1.default.Types.ObjectId(),
            note: note.trim(),
            createdAt: new Date(),
        };
        customer.notes.push(newNote);
        customer.lastContactAt = new Date();
        await customer.save();
        return respond_1.respond.ok(req, res, {
            id: newNote._id.toString(),
            createdAt: newNote.createdAt.toISOString(),
        });
    },
};
