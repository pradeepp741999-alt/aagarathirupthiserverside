import pino from 'pino';
import { env } from './env';

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'authorization',
      'otp',
      'otpHash',
      'token',
      'accessToken',
      'refreshToken',
      'refresh_token',
      'access_token',
      'numberEnc',
      'password',
      'passwordHash',
      '*.number',
      '*.mobile',
    ],
    censor: '[REDACTED]',
  },
  transport:
    env.NODE_ENV === 'development'
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
});
