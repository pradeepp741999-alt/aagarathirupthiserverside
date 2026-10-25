import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { Admin } from '@/models/Admin';
import { Provider } from '@/models/Provider';
import { ProviderDocument } from '@/models/ProviderDocument';
import { Payout } from '@/models/Payout';
import { SupportTicket } from '@/models/SupportTicket';
import { decryptDoc } from '@/common/utils/crypto';
import { notifyService } from '@/services/notify.service';
import { env } from '@/config/env';
import { parsePagination } from '@/common/http/pagination';
import { respond } from '@/common/http/respond';
import { AppError } from '@/common/errors/AppError';
import { ERROR_CODES } from '@/common/errors/errorCodes';

async function updateProviderVerifiedBadge(providerId: mongoose.Types.ObjectId) {
  const provider = await Provider.findById(providerId);
  if (!provider) return;

  if (provider.status !== 'approved') {
    provider.verified = false;
    await provider.save();
    return;
  }

  const isCatering =
    provider.category === 'catering' ||
    (provider.secondaryCategories || []).includes('catering');

  if (isCatering) {
    const fssaiDoc = await ProviderDocument.findOne({
      providerId,
      type: 'fssai',
      status: 'verified',
    });
    provider.verified = !!fssaiDoc;
  } else {
    provider.verified = true;
  }

  await provider.save();
}

export const adminController = {
  // 1. POST /admin/auth/login
  async login(req: Request, res: Response) {
    const { email, password } = req.body;
    if (!email || !password) {
      throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'email and password are required');
    }

    const admin = await Admin.findOne({ email: email.toLowerCase() });
    if (!admin || !admin.isActive) {
      throw new AppError(401, ERROR_CODES.UNAUTHORIZED, 'Invalid admin email or password');
    }

    const isMatch = await bcrypt.compare(password, admin.passwordHash);
    if (!isMatch) {
      throw new AppError(401, ERROR_CODES.UNAUTHORIZED, 'Invalid admin email or password');
    }

    const token = jwt.sign(
      { sub: admin._id.toString(), role: 'admin' },
      env.JWT_ACCESS_SECRET,
      { expiresIn: '8h' }
    );

    return respond.ok(req, res, { accessToken: token });
  },

  // 2. GET /admin/providers
  async listProviders(req: Request, res: Response) {
    const { status, search } = req.query;
    const { page, limit, skip } = parsePagination(req.query);

    const query: Record<string, unknown> = {};

    if (status) {
      const statuses = (status as string).split(',').map((s) => s.trim());
      query.status = { $in: statuses };
    } else {
      query.status = { $in: ['pending', 'under_review'] };
    }

    if (search) {
      const reg = new RegExp((search as string).trim(), 'i');
      query.$or = [{ businessName: reg }, { ownerName: reg }, { mobile: reg }];
    }

    const [providers, total] = await Promise.all([
      Provider.find(query).sort({ submittedAt: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
      Provider.countDocuments(query),
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

    return respond.list(req, res, items, { page, limit, total });
  },

  // 3. GET /admin/providers/:id
  async getProviderDetail(req: Request, res: Response) {
    const { id } = req.params;
    const provider = await Provider.findById(id).lean();
    if (!provider) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Provider not found');
    }

    const docs = await ProviderDocument.find({ providerId: provider._id }).lean();

    const decryptedDocs = docs.map((d) => {
      let decryptedNumber: string | null = null;
      if (d.numberEnc) {
        try {
          decryptedNumber = decryptDoc(d.numberEnc);
        } catch {
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

    return respond.ok(req, res, {
      ...provider,
      id: provider._id.toString(),
      documents: decryptedDocs,
    });
  },

  // 4. POST /admin/providers/:id/approve
  async approveProvider(req: Request, res: Response) {
    const { id } = req.params;
    const adminId = req.auth!.sub;

    const provider = await Provider.findById(id);
    if (!provider) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Provider not found');
    }

    provider.status = 'approved';
    provider.approvedAt = new Date();
    provider.reviewedBy = adminId;
    provider.rejectionReason = undefined;
    provider.registrationStep = 7;
    await provider.save();

    await updateProviderVerifiedBadge(provider._id as mongoose.Types.ObjectId);

    notifyService
      .createNotification({
        recipientRole: 'provider',
        recipientId: provider._id,
        type: 'approval',
        title: "You're Approved!",
        message: 'Your Aagara Thirupthi provider account is now active. You can now receive customer enquiries!',
        referenceType: 'provider',
        referenceId: provider._id,
      })
      .catch(() => {});

    return respond.ok(req, res, { id: provider._id.toString(), status: 'approved' }, {
      message: 'Provider approved successfully',
    });
  },

  // 5. POST /admin/providers/:id/reject
  async rejectProvider(req: Request, res: Response) {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length === 0) {
      throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'Rejection reason is required');
    }

    const provider = await Provider.findById(id);
    if (!provider) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Provider not found');
    }

    provider.status = 'rejected';
    provider.rejectionReason = reason.trim();
    provider.verified = false;
    await provider.save();

    notifyService
      .createNotification({
        recipientRole: 'provider',
        recipientId: provider._id,
        type: 'approval',
        title: 'Application Update',
        message: `Your application requires changes: ${reason.trim()}`,
        referenceType: 'provider',
        referenceId: provider._id,
      })
      .catch(() => {});

    return respond.ok(req, res, { id: provider._id.toString(), status: 'rejected' }, {
      message: 'Provider application rejected',
    });
  },

  // 6. POST /admin/providers/:id/suspend
  async suspendProvider(req: Request, res: Response) {
    const { id } = req.params;
    const { reason } = req.body;

    const provider = await Provider.findById(id);
    if (!provider) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Provider not found');
    }

    provider.status = 'suspended';
    provider.rejectionReason = reason || 'Suspended by administration';
    provider.verified = false;
    provider.isOnline = false;
    await provider.save();

    return respond.ok(req, res, { id: provider._id.toString(), status: 'suspended' }, {
      message: 'Provider suspended',
    });
  },

  // 7. PATCH /admin/providers/:providerId/documents/:type
  async verifyDocument(req: Request, res: Response) {
    const { providerId, type } = req.params;
    const { action, reason } = req.body;
    const adminId = req.auth!.sub;

    if (!['verify', 'reject'].includes(action)) {
      throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, "action must be 'verify' or 'reject'");
    }

    const doc = await ProviderDocument.findOne({ providerId, type });
    if (!doc) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Document not found');
    }

    if (action === 'verify') {
      doc.status = 'verified';
      doc.verifiedAt = new Date();
      doc.verifiedBy = adminId;
      doc.rejectionReason = undefined;
    } else {
      doc.status = 'rejected';
      doc.rejectionReason = reason || 'Document image unreadable or details mismatch';
    }

    await doc.save();
    await updateProviderVerifiedBadge(new mongoose.Types.ObjectId(providerId));

    notifyService
      .createNotification({
        recipientRole: 'provider',
        recipientId: new mongoose.Types.ObjectId(providerId),
        type: 'document',
        title: action === 'verify' ? 'Document Verified' : 'Document Rejected',
        message:
          action === 'verify'
            ? `Your ${type.toUpperCase()} document has been verified.`
            : `Your ${type.toUpperCase()} document was rejected: ${doc.rejectionReason}`,
        referenceType: 'document',
        referenceId: doc._id,
      })
      .catch(() => {});

    return respond.ok(req, res, { type: doc.type, status: doc.status });
  },

  // 8. POST /admin/payouts
  async createPayout(req: Request, res: Response) {
    const { providerId, amount, method, utrNumber, payoutDate, bookingIds, status } = req.body;

    if (!providerId || typeof amount !== 'number' || amount <= 0) {
      throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'providerId and a valid amount are required');
    }

    const payout = await Payout.create({
      providerId: new mongoose.Types.ObjectId(providerId),
      amount,
      method: method || 'direct_neft',
      utrNumber,
      payoutDate: payoutDate || new Date().toISOString().slice(0, 10),
      bookingIds: Array.isArray(bookingIds) ? bookingIds.map((id: string) => new mongoose.Types.ObjectId(id)) : [],
      status: status || 'completed',
    });

    return respond.created(req, res, { id: payout._id.toString(), status: payout.status });
  },

  // 9. PATCH /admin/payouts/:id
  async updatePayout(req: Request, res: Response) {
    const { id } = req.params;
    const { status, utrNumber } = req.body;

    const payout = await Payout.findById(id);
    if (!payout) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Payout not found');
    }

    if (status) payout.status = status;
    if (utrNumber !== undefined) payout.utrNumber = utrNumber;
    await payout.save();

    return respond.ok(req, res, { id: payout._id.toString(), status: payout.status });
  },

  // 10. GET /admin/support/tickets
  async listTickets(req: Request, res: Response) {
    const { status } = req.query;
    const { page, limit, skip } = parsePagination(req.query);

    const query: Record<string, unknown> = {};
    if (status) {
      query.status = status;
    }

    const [tickets, total] = await Promise.all([
      SupportTicket.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      SupportTicket.countDocuments(query),
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

    return respond.list(req, res, items, { page, limit, total });
  },

  // 11. PATCH /admin/support/tickets/:id
  async updateTicket(req: Request, res: Response) {
    const { id } = req.params;
    const { status, reply } = req.body;

    const ticket = await SupportTicket.findById(id);
    if (!ticket) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Support ticket not found');
    }

    if (status) ticket.status = status;
    if (reply && reply.trim().length > 0) {
      ticket.replies.push({
        by: 'admin',
        message: reply.trim(),
        at: new Date(),
      });
    }

    await ticket.save();
    return respond.ok(req, res, { id: ticket._id.toString(), status: ticket.status });
  },
};
