import rateLimit from 'express-rate-limit';
import { AppError } from '../errors/AppError';
import { ERROR_CODES } from '../errors/errorCodes';

export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: () => {
    throw new AppError(429, ERROR_CODES.RATE_LIMITED, 'Too many requests, please try again later');
  },
});

export const sendOtpIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: () => {
    throw new AppError(429, ERROR_CODES.RATE_LIMITED, 'Too many OTP requests from this IP, please try again after an hour');
  },
});

export const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: () => {
    throw new AppError(429, ERROR_CODES.RATE_LIMITED, 'Too many admin login attempts, please try again later');
  },
});
