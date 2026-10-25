import mongoose from 'mongoose';
import { AppRole, CanonicalNotificationType } from '@/config/constants';
import { Notification } from '@/models/Notification';
import { Session } from '@/models/Session';
import { sendExpoPush } from './push/expo';
import { logger } from '@/config/logger';

export interface CreateNotificationOptions {
  recipientRole: AppRole;
  recipientId: string | mongoose.Types.ObjectId;
  type: CanonicalNotificationType;
  title: string;
  message: string;
  referenceType?: 'enquiry' | 'booking' | 'review' | 'provider' | 'document';
  referenceId?: string | mongoose.Types.ObjectId;
}

export const notifyService = {
  async createNotification(opts: CreateNotificationOptions) {
    try {
      const recipientObjectId = new mongoose.Types.ObjectId(opts.recipientId);
      const refIdString = opts.referenceId ? opts.referenceId.toString() : undefined;

      const notification = await Notification.create({
        recipientRole: opts.recipientRole,
        recipientId: recipientObjectId,
        type: opts.type,
        title: opts.title,
        message: opts.message,
        referenceType: opts.referenceType,
        referenceId: refIdString,
      });

      // Best effort push notification
      const session = await Session.findOne({
        subjectId: recipientObjectId,
        role: opts.recipientRole,
        pushToken: { $exists: true, $ne: null },
      })
        .sort({ updatedAt: -1 })
        .lean();

      if (session?.pushToken) {
        sendExpoPush([session.pushToken], opts.title, opts.message, {
          notificationId: notification._id.toString(),
          type: opts.type,
          referenceType: opts.referenceType,
          referenceId: refIdString,
        }).catch((err) => {
          logger.warn({ err }, 'Push dispatch error in background');
        });
      }

      return notification;
    } catch (err) {
      logger.error({ err, opts }, 'Failed to create notification');
      throw err;
    }
  },
};
