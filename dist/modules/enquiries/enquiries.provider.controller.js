"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.enquiriesProviderController = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const dayjs_1 = __importDefault(require("dayjs"));
const Enquiry_1 = require("@/models/Enquiry");
const Provider_1 = require("@/models/Provider");
const Booking_1 = require("@/models/Booking");
const enquiries_service_1 = require("./enquiries.service");
const enquiries_dto_1 = require("./enquiries.dto");
const enquiries_statusMap_1 = require("./enquiries.statusMap");
const crm_sync_service_1 = require("@/services/crm.sync.service");
const notify_service_1 = require("@/services/notify.service");
const calendar_service_1 = require("@/services/calendar.service");
const pagination_1 = require("@/common/http/pagination");
const money_1 = require("@/common/utils/money");
const respond_1 = require("@/common/http/respond");
const AppError_1 = require("@/common/errors/AppError");
const errorCodes_1 = require("@/common/errors/errorCodes");
exports.enquiriesProviderController = {
    // GET /enquiries (provider)
    async listEnquiries(req, res) {
        const providerId = req.auth.sub;
        const { status, search } = req.query;
        const { page, limit, skip } = (0, pagination_1.parsePagination)(req.query);
        const provObjId = new mongoose_1.default.Types.ObjectId(providerId);
        const query = { providerId: provObjId };
        if (status) {
            const statusList = status.split(',').map((s) => s.trim().toLowerCase());
            const canonicalSet = new Set();
            for (const s of statusList) {
                if (s === 'all')
                    continue;
                if (s === 'pending')
                    canonicalSet.add('submitted');
                else if (s === 'reviewing')
                    canonicalSet.add('provider_reviewing');
                else {
                    const c = (0, enquiries_statusMap_1.normalizeInputStatus)(s);
                    if (c)
                        canonicalSet.add(c);
                }
            }
            if (canonicalSet.size > 0) {
                query.status = { $in: Array.from(canonicalSet) };
            }
        }
        if (search) {
            const reg = new RegExp(search.trim(), 'i');
            query.$or = [
                { code: reg },
                { eventType: reg },
                { 'customer.name': reg },
                { 'customer.mobile': reg },
            ];
        }
        const [enquiries, total] = await Promise.all([
            Enquiry_1.Enquiry.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            Enquiry_1.Enquiry.countDocuments(query),
        ]);
        const items = enquiries.map((e) => (0, enquiries_dto_1.toProviderEnquiryListItemDto)(e));
        return respond_1.respond.list(req, res, items, { page, limit, total });
    },
    // GET /enquiries/counts (provider)
    async getCounts(req, res) {
        const providerId = req.auth.sub;
        const provObjId = new mongoose_1.default.Types.ObjectId(providerId);
        const enquiries = await Enquiry_1.Enquiry.find({ providerId: provObjId }).select('status').lean();
        const counts = {
            all: enquiries.length,
            pending: 0,
            reviewing: 0,
            quote_sent: 0,
            accepted: 0,
            cancelled: 0,
        };
        for (const e of enquiries) {
            if (e.status === 'submitted')
                counts.pending++;
            else if (e.status === 'provider_reviewing')
                counts.reviewing++;
            else if (e.status === 'quote_sent')
                counts.quote_sent++;
            else if (e.status === 'accepted')
                counts.accepted++;
            else if (e.status === 'cancelled' || e.status === 'rejected')
                counts.cancelled++;
        }
        return respond_1.respond.ok(req, res, counts);
    },
    // GET /enquiries/:id (provider)
    async getEnquiryById(req, res) {
        const providerId = req.auth.sub;
        const { id } = req.params;
        const enquiry = await Enquiry_1.Enquiry.findOne({
            _id: id,
            providerId: new mongoose_1.default.Types.ObjectId(providerId),
        });
        if (!enquiry) {
            throw new AppError_1.AppError(404, errorCodes_1.ERROR_CODES.NOT_FOUND, 'Enquiry not found');
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
            await crm_sync_service_1.crmSyncService.recompute(enquiry.providerId, enquiry.customer.mobile);
        }
        else if (enquiry.isNewLead) {
            enquiry.isNewLead = false;
            await enquiry.save();
        }
        const dto = (0, enquiries_dto_1.toProviderEnquiryDetailDto)(enquiry);
        return respond_1.respond.ok(req, res, dto);
    },
    // PATCH /enquiries/:id/status (provider)
    async updateStatus(req, res) {
        const providerId = req.auth.sub;
        const { id } = req.params;
        const { status: rawStatus, note } = req.body;
        if (!rawStatus) {
            throw new AppError_1.AppError(422, errorCodes_1.ERROR_CODES.VALIDATION_ERROR, 'status is required');
        }
        const targetStatus = (0, enquiries_statusMap_1.normalizeInputStatus)(rawStatus);
        const enquiry = await Enquiry_1.Enquiry.findOne({
            _id: id,
            providerId: new mongoose_1.default.Types.ObjectId(providerId),
        });
        if (!enquiry) {
            throw new AppError_1.AppError(404, errorCodes_1.ERROR_CODES.NOT_FOUND, 'Enquiry not found');
        }
        if (['completed', 'cancelled', 'rejected'].includes(enquiry.status)) {
            throw new AppError_1.AppError(409, errorCodes_1.ERROR_CODES.INVALID_STATUS_TRANSITION, `Cannot change status of enquiry in terminal state: ${enquiry.status}`);
        }
        let bookingId = undefined;
        if (targetStatus === 'confirmed') {
            const provider = await Provider_1.Provider.findById(providerId);
            const booking = await enquiries_service_1.enquiriesService.confirmBookingFromEnquiry(enquiry, provider);
            bookingId = booking._id.toString();
        }
        else if (targetStatus === 'rejected') {
            if (!note || note.trim().length === 0) {
                throw new AppError_1.AppError(422, errorCodes_1.ERROR_CODES.VALIDATION_ERROR, 'Reason/note is required when declining an enquiry');
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
            await crm_sync_service_1.crmSyncService.recompute(enquiry.providerId, enquiry.customer.mobile);
            notify_service_1.notifyService
                .createNotification({
                recipientRole: 'user',
                recipientId: enquiry.userId,
                type: 'enquiry_update',
                title: 'Enquiry declined',
                message: 'The provider is unable to accommodate this event booking',
                referenceType: 'enquiry',
                referenceId: enquiry._id,
            })
                .catch(() => { });
        }
        else if (targetStatus === 'cancelled') {
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
                await Booking_1.Booking.findByIdAndUpdate(enquiry.bookingId, {
                    status: 'cancelled',
                    cancelledAt: new Date(),
                    cancelledBy: 'provider',
                });
                await calendar_service_1.calendarService.freeDates(enquiry.providerId, enquiry.bookingId);
            }
            await enquiry.save();
            await crm_sync_service_1.crmSyncService.recompute(enquiry.providerId, enquiry.customer.mobile);
            notify_service_1.notifyService
                .createNotification({
                recipientRole: 'user',
                recipientId: enquiry.userId,
                type: 'booking',
                title: 'Booking cancelled',
                message: 'Provider has cancelled this booking reservation',
                referenceType: 'enquiry',
                referenceId: enquiry._id,
            })
                .catch(() => { });
        }
        else if (targetStatus === 'accepted') {
            enquiry.status = 'accepted';
            enquiry.timeline.push({
                kind: 'status',
                status: 'accepted',
                author: 'provider',
                message: 'Quote marked accepted (customer agreement recorded)',
                at: new Date(),
            });
            await enquiry.save();
            await crm_sync_service_1.crmSyncService.recompute(enquiry.providerId, enquiry.customer.mobile);
        }
        else if (targetStatus === 'quote_sent') {
            if (!enquiry.quote) {
                throw new AppError_1.AppError(422, errorCodes_1.ERROR_CODES.QUOTE_REQUIRED, 'Please send a quote using POST /enquiries/:id/quote');
            }
            enquiry.status = 'quote_sent';
            await enquiry.save();
        }
        else {
            throw new AppError_1.AppError(409, errorCodes_1.ERROR_CODES.INVALID_STATUS_TRANSITION, `Invalid status transition to: ${targetStatus}`);
        }
        const providerStatus = enquiries_statusMap_1.CANONICAL_TO_PROVIDER_STATUS[enquiry.status] || enquiry.status;
        const resData = {
            id: enquiry._id.toString(),
            status: providerStatus,
            updatedAt: enquiry.updatedAt.toISOString(),
        };
        if (bookingId) {
            resData.bookingId = bookingId;
        }
        return respond_1.respond.ok(req, res, resData);
    },
    // POST /enquiries/:id/quote (provider)
    async sendQuote(req, res) {
        const providerId = req.auth.sub;
        const { id } = req.params;
        const { quoteAmount, validUntil, inclusions, terms, message } = req.body;
        if (typeof quoteAmount !== 'number' || quoteAmount <= 0) {
            throw new AppError_1.AppError(422, errorCodes_1.ERROR_CODES.VALIDATION_ERROR, 'quote_amount must be greater than 0');
        }
        const enquiry = await Enquiry_1.Enquiry.findOne({
            _id: id,
            providerId: new mongoose_1.default.Types.ObjectId(providerId),
        });
        if (!enquiry) {
            throw new AppError_1.AppError(404, errorCodes_1.ERROR_CODES.NOT_FOUND, 'Enquiry not found');
        }
        if (['completed', 'cancelled', 'rejected'].includes(enquiry.status)) {
            throw new AppError_1.AppError(409, errorCodes_1.ERROR_CODES.INVALID_STATUS_TRANSITION, 'Cannot send a quote for a completed or cancelled enquiry');
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
            const diffMinutes = Math.max(1, (0, dayjs_1.default)().diff((0, dayjs_1.default)(enquiry.createdAt), 'minute'));
            const prov = await Provider_1.Provider.findById(providerId);
            if (prov) {
                prov.avgResponseMinutes = Math.round((prov.avgResponseMinutes + diffMinutes) / 2);
                await prov.save();
            }
        }
        enquiry.timeline.push({
            kind: 'status',
            status: 'quote_sent',
            author: 'provider',
            message: `Quote submitted: ${(0, money_1.formatINR)(quoteAmount)}`,
            at: new Date(),
        });
        await enquiry.save();
        await crm_sync_service_1.crmSyncService.recompute(enquiry.providerId, enquiry.customer.mobile);
        const provider = await Provider_1.Provider.findById(providerId).lean();
        notify_service_1.notifyService
            .createNotification({
            recipientRole: 'user',
            recipientId: enquiry.userId,
            type: 'quote_received',
            title: 'Quote Received!',
            message: `${provider?.businessName || 'Provider'} sent a quote for ${(0, money_1.formatINR)(quoteAmount)}`,
            referenceType: 'enquiry',
            referenceId: enquiry._id,
        })
            .catch(() => { });
        return respond_1.respond.ok(req, res, undefined, {
            message: 'Quote sent to customer and SMS notification dispatched',
        });
    },
    // POST /enquiries/:id/messages (provider)
    async appendMessage(req, res) {
        const providerId = req.auth.sub;
        const { id } = req.params;
        const { message } = req.body;
        if (!message || message.trim().length === 0) {
            throw new AppError_1.AppError(422, errorCodes_1.ERROR_CODES.VALIDATION_ERROR, 'message cannot be empty');
        }
        const enquiry = await Enquiry_1.Enquiry.findOne({
            _id: id,
            providerId: new mongoose_1.default.Types.ObjectId(providerId),
        });
        if (!enquiry) {
            throw new AppError_1.AppError(404, errorCodes_1.ERROR_CODES.NOT_FOUND, 'Enquiry not found');
        }
        const now = new Date();
        enquiry.timeline.push({
            kind: 'message',
            author: 'provider',
            message: message.trim(),
            at: now,
        });
        await enquiry.save();
        return respond_1.respond.ok(req, res, {
            id: enquiry._id.toString(),
            createdAt: now.toISOString(),
        });
    },
};
