"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.startJobs = startJobs;
exports.stopJobs = stopJobs;
const env_js_1 = require("../config/env.js");
const logger_js_1 = require("../config/logger.js");
const documentExpiry_job_js_1 = require("./documentExpiry.job.js");
const staleEnquiry_job_js_1 = require("./staleEnquiry.job.js");
const comboHousekeeping_job_js_1 = require("./comboHousekeeping.job.js");
const tasks = [];
function startJobs() {
    if (!env_js_1.env.JOBS_ENABLED) {
        logger_js_1.logger.info('Background cron jobs disabled via JOBS_ENABLED=false');
        return;
    }
    logger_js_1.logger.info('Starting background cron jobs...');
    tasks.push((0, documentExpiry_job_js_1.scheduleDocumentExpiryJob)());
    tasks.push((0, staleEnquiry_job_js_1.scheduleStaleEnquiryJob)());
    tasks.push((0, comboHousekeeping_job_js_1.scheduleComboHousekeepingJob)());
    logger_js_1.logger.info({ totalJobs: tasks.length }, 'All background cron jobs scheduled successfully');
}
function stopJobs() {
    logger_js_1.logger.info('Stopping background cron jobs...');
    for (const task of tasks) {
        task.stop();
    }
    tasks.length = 0;
    logger_js_1.logger.info('All background cron jobs stopped');
}
