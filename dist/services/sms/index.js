"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.smsService = void 0;
const env_1 = require("@/config/env");
const logger_1 = require("@/config/logger");
exports.smsService = {
    async sendSms(options) {
        const driver = env_1.env.SMS_DRIVER;
        if (driver === 'console' || env_1.env.OTP_DEV_MODE) {
            logger_1.logger.info({
                to: options.toMobile.slice(-4),
                otp: env_1.env.OTP_DEV_MODE ? options.otp : '[HIDDEN]',
                message: options.message,
            }, `[SMS CONSOLE ADAPTER] SMS dispatched to +91 ${options.toMobile}`);
            return true;
        }
        try {
            if (driver === 'msg91') {
                // Msg91 integration stub
                logger_1.logger.info({ to: options.toMobile.slice(-4) }, 'Msg91 SMS sent');
                return true;
            }
            if (driver === 'fast2sms') {
                // Fast2SMS integration stub
                logger_1.logger.info({ to: options.toMobile.slice(-4) }, 'Fast2SMS dispatched');
                return true;
            }
            if (driver === 'twilio') {
                // Twilio integration stub
                logger_1.logger.info({ to: options.toMobile.slice(-4) }, 'Twilio SMS dispatched');
                return true;
            }
        }
        catch (err) {
            logger_1.logger.error({ err, driver }, 'Failed to dispatch SMS through provider driver');
            return false;
        }
        return true;
    },
};
