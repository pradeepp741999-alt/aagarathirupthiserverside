import cron, { ScheduledTask } from 'node-cron';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { scheduleDocumentExpiryJob } from './documentExpiry.job.js';
import { scheduleStaleEnquiryJob } from './staleEnquiry.job.js';
import { scheduleComboHousekeepingJob } from './comboHousekeeping.job.js';

const tasks: ScheduledTask[] = [];

export function startJobs(): void {
  if (!env.JOBS_ENABLED) {
    logger.info('Background cron jobs disabled via JOBS_ENABLED=false');
    return;
  }

  logger.info('Starting background cron jobs...');
  tasks.push(scheduleDocumentExpiryJob());
  tasks.push(scheduleStaleEnquiryJob());
  tasks.push(scheduleComboHousekeepingJob());
  logger.info({ totalJobs: tasks.length }, 'All background cron jobs scheduled successfully');
}

export function stopJobs(): void {
  logger.info('Stopping background cron jobs...');
  for (const task of tasks) {
    task.stop();
  }
  tasks.length = 0;
  logger.info('All background cron jobs stopped');
}
