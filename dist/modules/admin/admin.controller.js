"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminController = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const mongoose_1 = __importDefault(require("mongoose"));
const Admin_1 = require("@/models/Admin");
const Provider_1 = require("@/models/Provider");
const ProviderDocument_1 = require("@/models/ProviderDocument");
const Payout_1 = require("@/models/Payout");
const SupportTicket_1 = require("@/models/SupportTicket");
const crypto_1 = require("@/common/utils/crypto");
const notify_service_1 = require("@/services/notify.service");
const env_1 = require("@/config/env");
const pagination_1 = require("@/common/http/pagination");
const respond_1 = require("@/common/http/respond");
const AppError_1 = require("@/common/errors/AppError");
const errorCodes_1 = require("@/common/errors/errorCodes");
async function updateProviderVerifiedBadge(providerId) {
    const provider = await Provider_1.Provider.findById(providerId);
    if (!provider)
        return;
    if (provider.status !== 'approved') {
        provider.verified = false;
        await provider.save();
        return;
    }
    const isCatering = provider.category === 'catering' ||
        (provider.secondaryCategories || []).includes('catering');
    if (isCatering) {
        const fssaiDoc = await ProviderDocument_1.ProviderDocument.findOne({
            providerId,
            type: 'fssai',
            status: 'verified',
        });
        provider.verified = !!fssaiDoc;
    }
    else {
        provider.verified = true;
    }
    await provider.save();
}
exports.adminController = {
    // 1. POST /admin/auth/login
    async login(req, res) {
        const { email, password } = req.body;
        if (!email || !password) {
            throw new AppError_1.AppError(400, errorCodes_1.ERROR_CODES.VALIDATION_ERROR, 'email and password are required');
        }
        const admin = await Admin_1.Admin.findOne({ email: email.toLowerCase() });
        if (!admin || !admin.isActive) {
            throw new AppError_1.AppError(401, errorCodes_1.ERROR_CODES.UNAUTHORIZED, 'Invalid admin email or password');
        }
        const isMatch = await bcryptjs_1.default.compare(password, admin.passwordHash);
        if (!isMatch) {
            throw new AppError_1.AppError(401, errorCodes_1.ERROR_CODES.UNAUTHORIZED, 'Invalid admin email or password');
        }
        const token = jsonwebtoken_1.default.sign({ sub: admin._id.toString(), role: 'admin' }, env_1.env.JWT_ACCESS_SECRET, { expiresIn: '8h' });
        return respond_1.respond.ok(req, res, { accessToken: token });
    },
    // 2. GET /admin/providers
    async listProviders(req, res) {
        const { status, search } = req.query;
        const { page, limit, skip } = (0, pagination_1.parsePagination)(req.query);
        const query = {};
        if (status) {
            const statuses = status.split(',').map((s) => s.trim());
            query.status = { $in: statuses };
        }
        else {
            query.status = { $in: ['pending', 'under_review'] };
        }
        if (search) {
            const reg = new RegExp(search.trim(), 'i');
            query.$or = [{ businessName: reg }, { ownerName: reg }, { mobile: reg }];
        }
        const [providers, total] = await Promise.all([
            Provider_1.Provider.find(query).sort({ submittedAt: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
            Provider_1.Provider.countDocuments(query),
        ]);
        const items = providers.map((p) => ({
            id: p._id.toString(),
            businessName: p.businessName || 'Business',
            ownerName: p.ownerName || 'Owner',
            mobile: p.mobile,
            category: p.category,
            district: p.district,
            status: p.status,
            submittedAt: p.submittedAt ? p.submittedAt.toISOString() : null,
            createdAt: p.createdAt.toISOString(),
        }));
        return respond_1.respond.list(req, res, items, { page, limit, total });
    },
    // 3. GET /admin/providers/:id
    async getProviderDetail(req, res) {
        const { id } = req.params;
        const provider = await Provider_1.Provider.findById(id).lean();
        if (!provider) {
            throw new AppError_1.AppError(404, errorCodes_1.ERROR_CODES.NOT_FOUND, 'Provider not found');
        }
        const docs = await ProviderDocument_1.ProviderDocument.find({ providerId: provider._id }).lean();
        const decryptedDocs = docs.map((d) => {
            let decryptedNumber = null;
            if (d.numberEnc) {
                try {
                    decryptedNumber = (0, crypto_1.decryptDoc)(d.numberEnc);
                }
                catch {
                    decryptedNumber = d.numberMasked || null;
                }
            }
            return {
                id: d._id.toString(),
                type: d.type,
                status: d.status,
                number: decryptedNumber,
                numberMasked: d.numberMasked || null,
                fileUrl: d.fileUrl,
                expiryDate: d.expiryDate || null,
                rejectionReason: d.rejectionReason || null,
                verifiedAt: d.verifiedAt ? d.verifiedAt.toISOString() : null,
            };
        });
        return respond_1.respond.ok(req, res, {
            ...provider,
            id: provider._id.toString(),
            documents: decryptedDocs,
        });
    },
    // 4. POST /admin/providers/:id/approve
    async approveProvider(req, res) {
        const { id } = req.params;
        const adminId = req.auth.sub;
        const provider = await Provider_1.Provider.findById(id);
        if (!provider) {
            throw new AppError_1.AppError(404, errorCodes_1.ERROR_CODES.NOT_FOUND, 'Provider not found');
        }
        provider.status = 'approved';
        provider.approvedAt = new Date();
        provider.reviewedBy = adminId;
        provider.rejectionReason = undefined;
        provider.registrationStep = 7;
        await provider.save();
        await updateProviderVerifiedBadge(provider._id);
        notify_service_1.notifyService
            .createNotification({
            recipientRole: 'provider',
            recipientId: provider._id,
            type: 'approval',
            title: "You're Approved!",
            message: 'Your Aagara Thirupthi provider account is now active. You can now receive customer enquiries!',
            referenceType: 'provider',
            referenceId: provider._id,
        })
            .catch(() => { });
        return respond_1.respond.ok(req, res, { id: provider._id.toString(), status: 'approved' }, {
            message: 'Provider approved successfully',
        });
    },
    // 5. POST /admin/providers/:id/reject
    async rejectProvider(req, res) {
        const { id } = req.params;
        const { reason } = req.body;
        if (!reason || reason.trim().length === 0) {
            throw new AppError_1.AppError(400, errorCodes_1.ERROR_CODES.VALIDATION_ERROR, 'Rejection reason is required');
        }
        const provider = await Provider_1.Provider.findById(id);
        if (!provider) {
            throw new AppError_1.AppError(404, errorCodes_1.ERROR_CODES.NOT_FOUND, 'Provider not found');
        }
        provider.status = 'rejected';
        provider.rejectionReason = reason.trim();
        provider.verified = false;
        await provider.save();
        notify_service_1.notifyService
            .createNotification({
            recipientRole: 'provider',
            recipientId: provider._id,
            type: 'approval',
            title: 'Application Update',
            message: `Your application requires changes: ${reason.trim()}`,
            referenceType: 'provider',
            referenceId: provider._id,
        })
            .catch(() => { });
        return respond_1.respond.ok(req, res, { id: provider._id.toString(), status: 'rejected' }, {
            message: 'Provider application rejected',
        });
    },
    // 6. POST /admin/providers/:id/suspend
    async suspendProvider(req, res) {
        const { id } = req.params;
        const { reason } = req.body;
        const provider = await Provider_1.Provider.findById(id);
        if (!provider) {
            throw new AppError_1.AppError(404, errorCodes_1.ERROR_CODES.NOT_FOUND, 'Provider not found');
        }
        provider.status = 'suspended';
        provider.rejectionReason = reason || 'Suspended by administration';
        provider.verified = false;
        provider.isOnline = false;
        await provider.save();
        return respond_1.respond.ok(req, res, { id: provider._id.toString(), status: 'suspended' }, {
            message: 'Provider suspended',
        });
    },
    // 7. PATCH /admin/providers/:providerId/documents/:type
    async verifyDocument(req, res) {
        const { providerId, type } = req.params;
        const { action, reason } = req.body;
        const adminId = req.auth.sub;
        if (!['verify', 'reject'].includes(action)) {
            throw new AppError_1.AppError(400, errorCodes_1.ERROR_CODES.VALIDATION_ERROR, "action must be 'verify' or 'reject'");
        }
        const doc = await ProviderDocument_1.ProviderDocument.findOne({ providerId, type });
        if (!doc) {
            throw new AppError_1.AppError(404, errorCodes_1.ERROR_CODES.NOT_FOUND, 'Document not found');
        }
        if (action === 'verify') {
            doc.status = 'verified';
            doc.verifiedAt = new Date();
            doc.verifiedBy = adminId;
            doc.rejectionReason = undefined;
        }
        else {
            doc.status = 'rejected';
            doc.rejectionReason = reason || 'Document image unreadable or details mismatch';
        }
        await doc.save();
        await updateProviderVerifiedBadge(new mongoose_1.default.Types.ObjectId(providerId));
        notify_service_1.notifyService
            .createNotification({
            recipientRole: 'provider',
            recipientId: new mongoose_1.default.Types.ObjectId(providerId),
            type: 'document',
            title: action === 'verify' ? 'Document Verified' : 'Document Rejected',
            message: action === 'verify'
                ? `Your ${type.toUpperCase()} document has been verified.`
                : `Your ${type.toUpperCase()} document was rejected: ${doc.rejectionReason}`,
            referenceType: 'document',
            referenceId: doc._id,
        })
            .catch(() => { });
        return respond_1.respond.ok(req, res, { type: doc.type, status: doc.status });
    },
    // 8. POST /admin/payouts
    async createPayout(req, res) {
        const { providerId, amount, method, utrNumber, payoutDate, bookingIds, status } = req.body;
        if (!providerId || typeof amount !== 'number' || amount <= 0) {
            throw new AppError_1.AppError(400, errorCodes_1.ERROR_CODES.VALIDATION_ERROR, 'providerId and a valid amount are required');
        }
        const payout = await Payout_1.Payout.create({
            providerId: new mongoose_1.default.Types.ObjectId(providerId),
            amount,
            method: method || 'direct_neft',
            utrNumber,
            payoutDate: payoutDate || new Date().toISOString().slice(0, 10),
            bookingIds: Array.isArray(bookingIds) ? bookingIds.map((id) => new mongoose_1.default.Types.ObjectId(id)) : [],
            status: status || 'completed',
        });
        return respond_1.respond.created(req, res, { id: payout._id.toString(), status: payout.status });
    },
    // 9. PATCH /admin/payouts/:id
    async updatePayout(req, res) {
        const { id } = req.params;
        const { status, utrNumber } = req.body;
        const payout = await Payout_1.Payout.findById(id);
        if (!payout) {
            throw new AppError_1.AppError(404, errorCodes_1.ERROR_CODES.NOT_FOUND, 'Payout not found');
        }
        if (status)
            payout.status = status;
        if (utrNumber !== undefined)
            payout.utrNumber = utrNumber;
        await payout.save();
        return respond_1.respond.ok(req, res, { id: payout._id.toString(), status: payout.status });
    },
    // 10. GET /admin/support/tickets
    async listTickets(req, res) {
        const { status } = req.query;
        const { page, limit, skip } = (0, pagination_1.parsePagination)(req.query);
        const query = {};
        if (status) {
            query.status = status;
        }
        const [tickets, total] = await Promise.all([
            SupportTicket_1.SupportTicket.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            SupportTicket_1.SupportTicket.countDocuments(query),
        ]);
        const items = tickets.map((t) => ({
            id: t._id.toString(),
            code: t.code,
            role: t.role,
            subjectId: t.subjectId.toString(),
            source: t.source,
            subject: t.subject,
            category: t.category,
            message: t.message,
            status: t.status,
            repliesCount: t.replies?.length || 0,
            createdAt: t.createdAt.toISOString(),
        }));
        return respond_1.respond.list(req, res, items, { page, limit, total });
    },
    // 11. PATCH /admin/support/tickets/:id
    async updateTicket(req, res) {
        const { id } = req.params;
        const { status, reply } = req.body;
        const ticket = await SupportTicket_1.SupportTicket.findById(id);
        if (!ticket) {
            throw new AppError_1.AppError(404, errorCodes_1.ERROR_CODES.NOT_FOUND, 'Support ticket not found');
        }
        if (status)
            ticket.status = status;
        if (reply && reply.trim().length > 0) {
            ticket.replies.push({
                by: 'admin',
                message: reply.trim(),
                at: new Date(),
            });
        }
        await ticket.save();
        return respond_1.respond.ok(req, res, { id: ticket._id.toString(), status: ticket.status });
    },
};
