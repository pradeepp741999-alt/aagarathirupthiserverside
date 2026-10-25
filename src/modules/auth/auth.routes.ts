import { Router } from 'express';
import { authController } from './auth.controller';
import {
  sendOtpSchema,
  verifyOtpSchema,
  resendOtpSchema,
  refreshTokenSchema,
  pushTokenSchema,
} from './auth.validation';
import { validate } from '@/common/middleware/validate';
import { authenticate } from '@/common/middleware/authenticate';
import { sendOtpIpLimiter } from '@/common/middleware/rateLimiters';
import { asyncHandler } from '@/common/utils/asyncHandler';

const router = Router();

router.post(
  '/auth/send-otp',
  sendOtpIpLimiter,
  validate({ body: sendOtpSchema }),
  asyncHandler(authController.sendOtp)
);

router.post(
  '/auth/verify-otp',
  validate({ body: verifyOtpSchema }),
  asyncHandler(authController.verifyOtp)
);

router.post(
  '/auth/resend-otp',
  sendOtpIpLimiter,
  validate({ body: resendOtpSchema }),
  asyncHandler(authController.resendOtp)
);

router.post(
  '/auth/logout',
  authenticate,
  asyncHandler(authController.logout)
);

// Additive A1 & A2 endpoints
router.post(
  '/auth/refresh-token',
  validate({ body: refreshTokenSchema }),
  asyncHandler(authController.refreshToken)
);

router.put(
  '/auth/push-token',
  authenticate,
  validate({ body: pushTokenSchema }),
  asyncHandler(authController.pushToken)
);

export const authRoutes = router;
