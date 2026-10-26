"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRoutes = void 0;
const express_1 = require("express");
const auth_controller_1 = require("./auth.controller");
const auth_validation_1 = require("./auth.validation");
const validate_1 = require("@/common/middleware/validate");
const authenticate_1 = require("@/common/middleware/authenticate");
const rateLimiters_1 = require("@/common/middleware/rateLimiters");
const asyncHandler_1 = require("@/common/utils/asyncHandler");
const router = (0, express_1.Router)();
router.post('/auth/send-otp', rateLimiters_1.sendOtpIpLimiter, (0, validate_1.validate)({ body: auth_validation_1.sendOtpSchema }), (0, asyncHandler_1.asyncHandler)(auth_controller_1.authController.sendOtp));
router.post('/auth/verify-otp', (0, validate_1.validate)({ body: auth_validation_1.verifyOtpSchema }), (0, asyncHandler_1.asyncHandler)(auth_controller_1.authController.verifyOtp));
router.post('/auth/resend-otp', rateLimiters_1.sendOtpIpLimiter, (0, validate_1.validate)({ body: auth_validation_1.resendOtpSchema }), (0, asyncHandler_1.asyncHandler)(auth_controller_1.authController.resendOtp));
router.post('/auth/logout', authenticate_1.authenticate, (0, asyncHandler_1.asyncHandler)(auth_controller_1.authController.logout));
// Additive A1 & A2 endpoints
router.post('/auth/refresh-token', (0, validate_1.validate)({ body: auth_validation_1.refreshTokenSchema }), (0, asyncHandler_1.asyncHandler)(auth_controller_1.authController.refreshToken));
router.put('/auth/push-token', authenticate_1.authenticate, (0, validate_1.validate)({ body: auth_validation_1.pushTokenSchema }), (0, asyncHandler_1.asyncHandler)(auth_controller_1.authController.pushToken));
exports.authRoutes = router;
