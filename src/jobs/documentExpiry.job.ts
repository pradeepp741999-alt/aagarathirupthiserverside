import cron, { ScheduledTask } from 'node-cron';
import { ProviderDocument } from '../models/ProviderDocument.js';
import { notifyService } from '../services/notify.service.js';
import { logger } from '../config/logger.js';
import { nowIST } from '../common/utils/dates.js';

export async function checkDocumentExpiry(): Promise<void> {
  const todayStr = nowIST().format('YYYY-MM-DD');
  logger.info({ today: todayStr }, 'Starting document expiry check job');

  try {
    // 1. Mark already expired documents
    const expiredDocs = await ProviderDocument.find({
      status: 'verified',
      expiryDate: { $lt: todayStr },
    });

    for (const doc of expiredDocs) {
      doc.status = 'expired';
      await doc.save();

      await notifyService.createNotification({
        recipientRole: 'provider',
        recipientId: doc.providerId,
        type: 'document',
        title: 'Document Expired',
        message: `Your ${doc.type.toUpperCase()} document has expired. Please re-upload a valid document to maintain your verified status.`,
        referenceType: 'document',
        referenceId: doc._id.toString(),
      });
    }

    // 2. Alert for documents expiring in 30, 7, and 1 day(s)
    const intervals = [
      { days: 30, label: '30 days' },
      { days: 7, label: '7 days' },
      { days: 1, label: '24 hours' },
    ];

    for (const interval of intervals) {
      const targetDate = nowIST().add(interval.days, 'day').format('YYYY-MM-DD');

      const expiringDocs = await ProviderDocument.find({
        status: 'verified',
        expiryDate: targetDate,
      });

      for (const doc of expiringDocs) {
        await notifyService.createNotification({
          recipientRole: 'provider',
          recipientId: doc.providerId,
          type: 'document',
          title: 'Document Expiring Soon',
          message: `Your ${doc.type.toUpperCase()} document will expire in ${interval.label}. Please upload an updated copy soon.`,
          referenceType: 'document',
          referenceId: doc._id.toString(),
        });
      }
    }

    logger.info({ processedExpired: expiredDocs.length }, 'Document expiry check completed');
  } catch (err) {
    logger.error({ err }, 'Error in document expiry job');
  }
}

export function scheduleDocumentExpiryJob(): ScheduledTask {
  // Run daily at 09:00 IST
  return cron.schedule('0 9 * * *', checkDocumentExpiry, {
    timezone: 'Asia/Kolkata',
  });
}
