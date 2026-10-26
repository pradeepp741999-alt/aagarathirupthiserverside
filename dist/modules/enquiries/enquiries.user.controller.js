"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.enquiriesUserController = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Enquiry_1 = require("@/models/Enquiry");
const Provider_1 = require("@/models/Provider");
const Booking_1 = require("@/models/Booking");
const enquiries_service_1 = require("./enquiries.service");
const enquiries_dto_1 = require("./enquiries.dto");
const enquiries_statusMap_1 = require("./enquiries.statusMap");
const crm_sync_service_1 = require("@/services/crm.sync.service");
const notify_service_1 = require("@/services/notify.service");
const calendar_service_1 = require("@/services/calendar.service");
const dates_1 = require("@/common/utils/dates");
const AppError_1 = require("@/common/errors/AppError");
const errorCodes_1 = require("@/common/errors/errorCodes");
exports.enquiriesUserController = {
    // POST /enquiries (user)
    async createEnquiry(req, res) {
        const userId = req.auth.sub;
        const enquiry = await enquiries_service_1.enquiriesService.submitEnquiry(userId, req.body);
        // User doc format: { id, code, status: 'submitted', createdAt: 'YYYY-MM-DD' }
        return res.status(201).json({
            id: enquiry._id.toString(),
            code: enquiry.code,
            status: 'submitted',
            createdAt: (0, dates_1.ymd)(enquiry.createdAt),
        });
    },
    // GET /enquiries (user)
    async listEnquiries(req, res) {
        const userId = req.auth.sub;
        const { status } = req.query;
        const query = {
            userId: new mongoose_1.default.Types.ObjectId(userId),
        };
        if (status) {
            const canonical = (0, enquiries_statusMap_1.normalizeInputStatus)(status);
            if (canonical) {
                query.status = canonical;
            }
        }
        const enquiries = await Enquiry_1.Enquiry.find(query)
            .sort({ createdAt: -1 })
            .populate('providerId', 'businessName mobile whatsapp rating reviewCount verified coverImage avgResponseMinutes')
            .lean();
        const dtos = enquiries.map((e) => (0, enquiries_dto_1.toUserEnquiryDto)(e, e.providerId));
        return res.status(200).json(dtos);
    },
    // GET /enquiries/summary (user)
    async getSummary(req, res) {
        const userId = req.auth.sub;
        const enquiries = await Enquiry_1.Enquiry.find({
            userId: new mongoose_1.default.Types.ObjectId(userId),
        }).lean();
        const activeCount = enquiries.filter((e) => ['submitted', 'provider_reviewing', 'quote_sent', 'accepted', 'confirmed'].includes(e.status)).length;
        const awaitingResponseCount = enquiries.filter((e) => e.status === 'quote_sent').length;
        return res.status(200).json({
            activeCount,
            awaitingResponseCount,
        });
    },
    // GET /enquiries/:id (user)
    async getEnquiryById(req, res) {
        const userId = req.auth.sub;
        const { id } = req.params;
        const enquiry = await Enquiry_1.Enquiry.findOne({
            _id: id,
            userId: new mongoose_1.default.Types.ObjectId(userId),
        })
            .populate('providerId', 'businessName mobile whatsapp rating reviewCount verified coverImage avgResponseMinutes')
            .lean();
        if (!enquiry) {
            throw new AppError_1.AppError(404, errorCodes_1.ERROR_CODES.NOT_FOUND, 'Enquiry not found');
        }
        const dto = (0, enquiries_dto_1.toUserEnquiryDto)(enquiry, enquiry.providerId);
        return res.status(200).json(dto);
    },
    // PATCH /enquiries/:id/status (user)
    async updateStatus(req, res) {
        const userId = req.auth.sub;
        const { id } = req.params;
        const { status: rawStatus, reason } = req.body;
        if (!rawStatus) {
            throw new AppError_1.AppError(400, errorCodes_1.ERROR_CODES.VALIDATION_ERROR, 'status is required');
        }
        const targetStatus = (0, enquiries_statusMap_1.normalizeInputStatus)(rawStatus);
        if (!targetStatus || !['accepted', 'cancelled'].includes(targetStatus)) {
            throw new AppError_1.AppError(400, errorCodes_1.ERROR_CODES.INVALID_STATUS_TRANSITION, "Customer may only update enquiry status to 'accepted' or 'cancelled'");
        }
        const enquiry = await Enquiry_1.Enquiry.findOne({
            _id: id,
            userId: new mongoose_1.default.Types.ObjectId(userId),
        });
        if (!enquiry) {
            throw new AppError_1.AppError(404, errorCodes_1.ERROR_CODES.NOT_FOUND, 'Enquiry not found');
        }
        if (['completed', 'cancelled', 'rejected'].includes(enquiry.status)) {
            throw new AppError_1.AppError(409, errorCodes_1.ERROR_CODES.INVALID_STATUS_TRANSITION, `Cannot change status of an enquiry in terminal state: ${enquiry.status}`);
        }
        const provider = await Provider_1.Provider.findById(enquiry.providerId).lean();
        if (targetStatus === 'accepted') {
            if (enquiry.status !== 'quote_sent') {
                throw new AppError_1.AppError(409, errorCodes_1.ERROR_CODES.INVALID_STATUS_TRANSITION, 'Quote must be received before accepting');
            }
            enquiry.status = 'accepted';
            enquiry.timeline.push({
                kind: 'status',
                status: 'accepted',
                author: 'customer',
                message: 'Customer accepted the quote',
                at: new Date(),
            });
            notify_service_1.notifyService
                .createNotification({
                recipientRole: 'provider',
                recipientId: enquiry.providerId,
                type: 'enquiry_update',
                title: 'Quote accepted',
                message: `${enquiry.customer.name || 'Customer'} accepted your quote`,
                referenceType: 'enquiry',
                referenceId: enquiry._id,
            })
                .catch(() => { });
        }
        else if (targetStatus === 'cancelled') {
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
                await Booking_1.Booking.findByIdAndUpdate(enquiry.bookingId, {
                    status: 'cancelled',
                    cancelledAt: new Date(),
                    cancelledBy: 'customer',
                });
                await calendar_service_1.calendarService.freeDates(enquiry.providerId, enquiry.bookingId);
            }
            notify_service_1.notifyService
                .createNotification({
                recipientRole: 'provider',
                recipientId: enquiry.providerId,
                type: 'enquiry_update',
                title: 'Enquiry cancelled',
                message: `${enquiry.customer.name || 'Customer'} cancelled their enquiry`,
                referenceType: 'enquiry',
                referenceId: enquiry._id,
            })
                .catch(() => { });
        }
        await enquiry.save();
        await crm_sync_service_1.crmSyncService.recompute(enquiry.providerId, enquiry.customer.mobile);
        const updatedDto = (0, enquiries_dto_1.toUserEnquiryDto)(enquiry, provider);
        return res.status(200).json(updatedDto);
    },
};
