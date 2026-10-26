"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationsController = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Notification_1 = require("@/models/Notification");
const dates_1 = require("@/common/utils/dates");
const pagination_1 = require("@/common/http/pagination");
const respond_1 = require("@/common/http/respond");
const AppError_1 = require("@/common/errors/AppError");
const errorCodes_1 = require("@/common/errors/errorCodes");
const CANONICAL_TO_USER_NOTIF_TYPE = {
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
exports.notificationsController = {
    // GET /notifications/unread-count
    async getUnreadCount(req, res) {
        const role = req.auth.role;
        const recipientId = req.auth.sub;
        const count = await Notification_1.Notification.countDocuments({
            recipientRole: role,
            recipientId: new mongoose_1.default.Types.ObjectId(recipientId),
            isRead: false,
        });
        if (role === 'provider' || role === 'admin') {
            return respond_1.respond.ok(req, res, { unreadCount: count });
        }
        return res.status(200).json({ unreadCount: count });
    },
    // PATCH /notifications/mark-all-read
    async markAllRead(req, res) {
        const role = req.auth.role;
        const recipientId = req.auth.sub;
        await Notification_1.Notification.updateMany({
            recipientRole: role,
            recipientId: new mongoose_1.default.Types.ObjectId(recipientId),
            isRead: false,
        }, { isRead: true });
        if (role === 'provider' || role === 'admin') {
            return respond_1.respond.ok(req, res, undefined, {
                message: 'All notifications marked as read',
            });
        }
        return res.status(200).json({ success: true });
    },
    // GET /notifications
    async listNotifications(req, res) {
        const role = req.auth.role;
        const recipientId = req.auth.sub;
        const { page, limit, skip } = (0, pagination_1.parsePagination)(req.query, 30, 100);
        const query = {
            recipientRole: role,
            recipientId: new mongoose_1.default.Types.ObjectId(recipientId),
        };
        const [notifications, total] = await Promise.all([
            Notification_1.Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
            Notification_1.Notification.countDocuments(query),
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
            return respond_1.respond.list(req, res, items, { page, limit, total });
        }
        // User notification shape
        const items = notifications.map((n) => ({
            id: n._id.toString(),
            title: n.title,
            message: n.message,
            time: (0, dates_1.relativeTime)(n.createdAt),
            read: n.isRead,
            type: CANONICAL_TO_USER_NOTIF_TYPE[n.type] || 'system',
            createdAt: n.createdAt.toISOString(),
            referenceId: n.referenceId || null,
        }));
        return res.status(200).json(items);
    },
    // PATCH /notifications/:id/read
    async markRead(req, res) {
        const role = req.auth.role;
        const recipientId = req.auth.sub;
        const { id } = req.params;
        const notif = await Notification_1.Notification.findOneAndUpdate({
            _id: id,
            recipientRole: role,
            recipientId: new mongoose_1.default.Types.ObjectId(recipientId),
        }, { isRead: true }, { new: true });
        if (!notif) {
            throw new AppError_1.AppError(404, errorCodes_1.ERROR_CODES.NOT_FOUND, 'Notification not found');
        }
        if (role === 'provider' || role === 'admin') {
            return respond_1.respond.ok(req, res, { id: notif._id.toString(), read: true });
        }
        return res.status(200).json({ success: true });
    },
    // DELETE /notifications/:id
    async deleteNotification(req, res) {
        const role = req.auth.role;
        const recipientId = req.auth.sub;
        const { id } = req.params;
        const notif = await Notification_1.Notification.findOneAndDelete({
            _id: id,
            recipientRole: role,
            recipientId: new mongoose_1.default.Types.ObjectId(recipientId),
        });
        if (!notif) {
            throw new AppError_1.AppError(404, errorCodes_1.ERROR_CODES.NOT_FOUND, 'Notification not found');
        }
        return respond_1.respond.message(req, res, 'Notification removed');
    },
};
