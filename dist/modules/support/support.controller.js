"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.supportController = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const SupportTicket_1 = require("@/models/SupportTicket");
const counters_1 = require("@/common/utils/counters");
const respond_1 = require("@/common/http/respond");
const AppError_1 = require("@/common/errors/AppError");
const errorCodes_1 = require("@/common/errors/errorCodes");
exports.supportController = {
    // POST /support/enquiry
    async createSupportEnquiry(req, res) {
        const role = req.auth?.role || req.appRole || 'user';
        const subjectId = req.auth?.sub || new mongoose_1.default.Types.ObjectId().toString();
        const { subject, message } = req.body;
        if (!subject || !message) {
            throw new AppError_1.AppError(422, errorCodes_1.ERROR_CODES.VALIDATION_ERROR, 'subject and message are required');
        }
        const code = await (0, counters_1.nextCode)('ticket');
        await SupportTicket_1.SupportTicket.create({
            code,
            role,
            subjectId: new mongoose_1.default.Types.ObjectId(subjectId),
            source: 'support_enquiry',
            subject: subject.trim(),
            category: 'general',
            message: message.trim(),
            status: 'open',
            replies: [],
        });
        return respond_1.respond.ok(req, res, undefined, {
            message: `Support enquiry logged. Ticket #${code} created.`,
        });
    },
    // POST /support/tickets
    async createTicket(req, res) {
        const role = req.auth?.role || req.appRole || 'user';
        const subjectId = req.auth?.sub || new mongoose_1.default.Types.ObjectId().toString();
        const { subject, category, message } = req.body;
        if (!subject || !message) {
            throw new AppError_1.AppError(422, errorCodes_1.ERROR_CODES.VALIDATION_ERROR, 'subject and message are required');
        }
        const code = await (0, counters_1.nextCode)('ticket');
        const ticket = await SupportTicket_1.SupportTicket.create({
            code,
            role,
            subjectId: new mongoose_1.default.Types.ObjectId(subjectId),
            source: 'ticket',
            subject: subject.trim(),
            category: category || 'general',
            message: message.trim(),
            status: 'open',
            replies: [],
        });
        return respond_1.respond.created(req, res, {
            ticketId: ticket.code,
            status: ticket.status,
            message: 'Support ticket created. Our team will contact you within 4 hours.',
        });
    },
};
