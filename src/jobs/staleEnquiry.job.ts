import cron, { ScheduledTask } from 'node-cron';
import { Enquiry } from '../models/Enquiry.js';
import { Provider } from '../models/Provider.js';
import { notifyService } from '../services/notify.service.js';
import { logger } from '../config/logger.js';
import { nowIST } from '../common/utils/dates.js';

export async function checkStaleEnquiries(): Promise<void> {
  const cutoff = nowIST().subtract(24, 'hours').toDate();
  logger.info({ cutoff }, 'Starting stale enquiry check job');

  try {
    const staleEnquiries = await Enquiry.find({
      status: 'submitted',
      createdAt: { $lt: cutoff },
    });

    for (const enquiry of staleEnquiries) {
      enquiry.status = 'cancelled';
      enquiry.cancelledBy = 'provider';
      enquiry.cancelReason = 'Auto-expired due to no response from provider within 24 hours';
      enquiry.timeline.push({
        kind: 'status',
        status: 'cancelled',
        author: 'system',
        message: 'Auto-expired due to no response from provider within 24 hours',
        at: new Date(),
      });
      await enquiry.save();

      const provider = await Provider.findById(enquiry.providerId);
      const providerName = provider?.businessName || 'the provider';

      // Notify User
      await notifyService.createNotification({
        recipientRole: 'user',
        recipientId: enquiry.userId,
        type: 'enquiry_update',
        title: 'Enquiry Expired',
        message: `Your enquiry (${enquiry.code}) to ${providerName} has expired as the provider did not respond within 24 hours.`,
        referenceType: 'enquiry',
        referenceId: enquiry._id.toString(),
      });

      // Notify Provider
      await notifyService.createNotification({
        recipientRole: 'provider',
        recipientId: enquiry.providerId,
        type: 'enquiry_update',
        title: 'Enquiry Missed & Expired',
        message: `Enquiry (${enquiry.code}) has expired due to no response within 24 hours.`,
        referenceType: 'enquiry',
        referenceId: enquiry._id.toString(),
      });
    }

    logger.info({ count: staleEnquiries.length }, 'Stale enquiry check completed');
  } catch (err) {
    logger.error({ err }, 'Error in stale enquiry job');
  }
}

export function scheduleStaleEnquiryJob(): ScheduledTask {
  // Run hourly at minute 0
  return cron.schedule('0 * * * *', checkStaleEnquiries, {
    timezone: 'Asia/Kolkata',
  });
}
