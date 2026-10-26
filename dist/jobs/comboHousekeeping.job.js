"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkExpiredCombos = checkExpiredCombos;
exports.scheduleComboHousekeepingJob = scheduleComboHousekeepingJob;
const node_cron_1 = __importDefault(require("node-cron"));
const SpecialCombo_js_1 = require("../models/SpecialCombo.js");
const logger_js_1 = require("../config/logger.js");
const dates_js_1 = require("../common/utils/dates.js");
async function checkExpiredCombos() {
    const now = (0, dates_js_1.nowIST)().toDate();
    logger_js_1.logger.info({ now }, 'Starting combo housekeeping job');
    try {
        const result = await SpecialCombo_js_1.SpecialCombo.updateMany({
            isActive: true,
            validUntil: { $lt: now }
        }, {
            $set: { isActive: false }
        });
        logger_js_1.logger.info({ modifiedCount: result.modifiedCount }, 'Combo housekeeping completed');
    }
    catch (err) {
        logger_js_1.logger.error({ err }, 'Error in combo housekeeping job');
    }
}
function scheduleComboHousekeepingJob() {
    // Run daily at 00:30 IST
    return node_cron_1.default.schedule('30 0 * * *', checkExpiredCombos, {
        timezone: 'Asia/Kolkata'
    });
}
