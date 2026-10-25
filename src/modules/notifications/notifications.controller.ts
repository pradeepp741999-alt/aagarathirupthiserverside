import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Notification } from '@/models/Notification';
import { relativeTime } from '@/common/utils/dates';
import { CanonicalNotificationType } from '@/config/constants';
import { parsePagination } from '@/common/http/pagination';
import { respond } from '@/common/http/respond';
import { AppError } from '@/common/errors/AppError';
import { ERROR_CODES } from '@/common/errors/errorCodes';

const CANONICAL_TO_USER_NOTIF_TYPE: Record<CanonicalNotificationType, string> = {
  new_enquiry: 'enquiry',
  quote_received: 'enquiry',
  enquiry_update: 'enquiry',
  booking: 'booking',
  review: 'review',
  approval: 'system',
  document: 'system',
  system: 'system',
  promotion: 'promotion',
};

export const notificationsController = {
  // GET /notifications/unread-count
  async getUnreadCount(req: Request, res: Response) {
    const role = req.auth!.role;
    const recipientId = req.auth!.sub;

    const count = await Notification.countDocuments({
      recipientRole: role,
      recipientId: new mongoose.Types.ObjectId(recipientId),
      isRead: false,
    });

    if (role === 'provider' || role === 'admin') {
      return respond.ok(req, res, { unreadCount: count });
    }

    return res.status(200).json({ unreadCount: count });
  },

  // PATCH /notifications/mark-all-read
  async markAllRead(req: Request, res: Response) {
    const role = req.auth!.role;
    const recipientId = req.auth!.sub;

    await Notification.updateMany(
      {
        recipientRole: role,
        recipientId: new mongoose.Types.ObjectId(recipientId),
        isRead: false,
      },
      { isRead: true }
    );

    if (role === 'provider' || role === 'admin') {
      return respond.ok(req, res, undefined, {
        message: 'All notifications marked as read',
      });
    }

    return res.status(200).json({ success: true });
  },

  // GET /notifications
  async listNotifications(req: Request, res: Response) {
    const role = req.auth!.role;
    const recipientId = req.auth!.sub;
    const { page, limit, skip } = parsePagination(req.query, 30, 100);

    const query = {
      recipientRole: role,
      recipientId: new mongoose.Types.ObjectId(recipientId),
    };

    const [notifications, total] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(query),
    ]);

    if (role === 'provider' || role === 'admin') {
      const items = notifications.map((n) => ({
        id: n._id.toString(),
        type: n.type,
        title: n.title,
        message: n.message,
        read: n.isRead,
        referenceId: n.referenceId || null,
        createdAt: n.createdAt.toISOString(),
      }));

      return respond.list(req, res, items, { page, limit, total });
    }

    // User notification shape
    const items = notifications.map((n) => ({
      id: n._id.toString(),
      title: n.title,
      message: n.message,
      time: relativeTime(n.createdAt),
      read: n.isRead,
      type: CANONICAL_TO_USER_NOTIF_TYPE[n.type] || 'system',
      createdAt: n.createdAt.toISOString(),
      referenceId: n.referenceId || null,
    }));

    return res.status(200).json(items);
  },

  // PATCH /notifications/:id/read
  async markRead(req: Request, res: Response) {
    const role = req.auth!.role;
    const recipientId = req.auth!.sub;
    const { id } = req.params;

    const notif = await Notification.findOneAndUpdate(
      {
        _id: id,
        recipientRole: role,
        recipientId: new mongoose.Types.ObjectId(recipientId),
      },
      { isRead: true },
      { new: true }
    );

    if (!notif) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Notification not found');
    }

    if (role === 'provider' || role === 'admin') {
      return respond.ok(req, res, { id: notif._id.toString(), read: true });
    }

    return res.status(200).json({ success: true });
  },

  // DELETE /notifications/:id
  async deleteNotification(req: Request, res: Response) {
    const role = req.auth!.role;
    const recipientId = req.auth!.sub;
    const { id } = req.params;

    const notif = await Notification.findOneAndDelete({
      _id: id,
      recipientRole: role,
      recipientId: new mongoose.Types.ObjectId(recipientId),
    });

    if (!notif) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Notification not found');
    }

    return respond.message(req, res, 'Notification removed');
  },
};
