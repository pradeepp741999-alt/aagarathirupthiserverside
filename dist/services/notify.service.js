"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const Notification_1 = require("@/models/Notification");
const Session_1 = require("@/models/Session");
const expo_1 = require("./push/expo");
const logger_1 = require("@/config/logger");
exports.notifyService = {
    async createNotification(opts) {
        try {
            const recipientObjectId = new mongoose_1.default.Types.ObjectId(opts.recipientId);
            const refIdString = opts.referenceId ? opts.referenceId.toString() : undefined;
            const notification = await Notification_1.Notification.create({
                recipientRole: opts.recipientRole,
                recipientId: recipientObjectId,
                type: opts.type,
                title: opts.title,
                message: opts.message,
                referenceType: opts.referenceType,
                referenceId: refIdString,
            });
            // Best effort push notification
            const session = await Session_1.Session.findOne({
                subjectId: recipientObjectId,
                role: opts.recipientRole,
                pushToken: { $exists: true, $ne: null },
            })
                .sort({ updatedAt: -1 })
                .lean();
            if (session?.pushToken) {
                (0, expo_1.sendExpoPush)([session.pushToken], opts.title, opts.message, {
                    notificationId: notification._id.toString(),
                    type: opts.type,
                    referenceType: opts.referenceType,
                    referenceId: refIdString,
                }).catch((err) => {
                    logger_1.logger.warn({ err }, 'Push dispatch error in background');
                });
            }
            return notification;
        }
        catch (err) {
            logger_1.logger.error({ err, opts }, 'Failed to create notification');
            throw err;
        }
    },
};
