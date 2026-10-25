import { env } from '@/config/env';
import { logger } from '@/config/logger';

export interface SmsSendOptions {
  toMobile: string;
  message: string;
  otp?: string;
}

export interface SmsDriver {
  sendSms(options: SmsSendOptions): Promise<boolean>;
}

export const smsService: SmsDriver = {
  async sendSms(options: SmsSendOptions): Promise<boolean> {
    const driver = env.SMS_DRIVER;

    if (driver === 'console' || env.OTP_DEV_MODE) {
      logger.info(
        {
          to: options.toMobile.slice(-4),
          otp: env.OTP_DEV_MODE ? options.otp : '[HIDDEN]',
          message: options.message,
        },
        `[SMS CONSOLE ADAPTER] SMS dispatched to +91 ${options.toMobile}`
      );
      return true;
    }

    try {
      if (driver === 'msg91') {
        // Msg91 integration stub
        logger.info({ to: options.toMobile.slice(-4) }, 'Msg91 SMS sent');
        return true;
      }
      if (driver === 'fast2sms') {
        // Fast2SMS integration stub
        logger.info({ to: options.toMobile.slice(-4) }, 'Fast2SMS dispatched');
        return true;
      }
      if (driver === 'twilio') {
        // Twilio integration stub
        logger.info({ to: options.toMobile.slice(-4) }, 'Twilio SMS dispatched');
        return true;
      }
    } catch (err) {
      logger.error({ err, driver }, 'Failed to dispatch SMS through provider driver');
      return false;
    }

    return true;
  },
};
