import cron, { ScheduledTask } from 'node-cron';
import { SpecialCombo } from '../models/SpecialCombo.js';
import { logger } from '../config/logger.js';
import { nowIST } from '../common/utils/dates.js';

export async function checkExpiredCombos(): Promise<void> {
  const now = nowIST().toDate();
  logger.info({ now }, 'Starting combo housekeeping job');

  try {
    const result = await SpecialCombo.updateMany(
      {
        isActive: true,
        validUntil: { $lt: now }
      },
      {
        $set: { isActive: false }
      }
    );

    logger.info({ modifiedCount: result.modifiedCount }, 'Combo housekeeping completed');
  } catch (err) {
    logger.error({ err }, 'Error in combo housekeeping job');
  }
}

export function scheduleComboHousekeepingJob(): ScheduledTask {
  // Run daily at 00:30 IST
  return cron.schedule('30 0 * * *', checkExpiredCombos, {
    timezone: 'Asia/Kolkata'
  });
}
