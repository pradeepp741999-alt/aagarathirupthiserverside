"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = void 0;
const crypto_1 = __importDefault(require("crypto"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const env_1 = require("@/config/env");
const OtpSession_1 = require("@/models/OtpSession");
const User_1 = require("@/models/User");
const Provider_1 = require("@/models/Provider");
const Session_1 = require("@/models/Session");
const sms_1 = require("@/services/sms");
const token_service_1 = require("@/services/token.service");
const respond_1 = require("@/common/http/respond");
const AppError_1 = require("@/common/errors/AppError");
const errorCodes_1 = require("@/common/errors/errorCodes");
exports.authController = {
    async sendOtp(req, res) {
        const { mobile } = req.body;
        const role = req.appRole;
        // Check recent sessions in rate limit window
        const windowStart = new Date(Date.now() - env_1.env.OTP_WINDOW_MINUTES * 60 * 1000);
        const recentSessions = await OtpSession_1.OtpSession.find({
            mobile,
            role,
            createdAt: { $gte: windowStart },
        }).sort({ createdAt: -1 });
        if (recentSessions.length >= env_1.env.OTP_MAX_SENDS) {
            throw new AppError_1.AppError(429, errorCodes_1.ERROR_CODES.RATE_LIMITED, `Maximum ${env_1.env.OTP_MAX_SENDS} OTP requests allowed per ${env_1.env.OTP_WINDOW_MINUTES} minutes. Please try again later.`);
        }
        if (recentSessions.length > 0) {
            const lastSentAt = recentSessions[0].lastSentAt.getTime();
            const diffSec = Math.floor((Date.now() - lastSentAt) / 1000);
            if (diffSec < env_1.env.OTP_RESEND_COOLDOWN_SECONDS) {
                const retryAfterSeconds = env_1.env.OTP_RESEND_COOLDOWN_SECONDS - diffSec;
                throw new AppError_1.AppError(429, errorCodes_1.ERROR_CODES.RATE_LIMITED, `Please wait ${retryAfterSeconds} seconds before requesting a new OTP.`);
            }
        }
        const otp = env_1.env.OTP_DEV_MODE ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();
        const otpHash = await bcryptjs_1.default.hash(otp, 10);
        const txnId = `txn_${crypto_1.default.randomBytes(12).toString('hex')}`;
        const expiresAt = new Date(Date.now() + env_1.env.OTP_TTL_SECONDS * 1000);
        await OtpSession_1.OtpSession.create({
            mobile,
            role,
            txnId,
            otpHash,
            attempts: 0,
            sendCount: 1,
            windowStartedAt: new Date(),
            lastSentAt: new Date(),
            expiresAt,
        });
        await sms_1.smsService.sendSms({
            toMobile: mobile,
            otp,
            message: `Your Aagara Thirupthi verification code is ${otp}. Valid for 5 minutes. Do not share it.`,
        });
        if (role === 'provider') {
            return respond_1.respond.ok(req, res, {
                mobile,
                expires_in_seconds: env_1.env.OTP_TTL_SECONDS,
                resend_available_in_seconds: env_1.env.OTP_RESEND_COOLDOWN_SECONDS,
            }, {
                message: `OTP sent successfully to +91 ${mobile}`,
            });
        }
        // User response
        return res.status(200).json({
            success: true,
            message: 'OTP sent successfully',
            txnId,
            expiresInSeconds: env_1.env.OTP_TTL_SECONDS,
        });
    },
    async verifyOtp(req, res) {
        const { mobile, otp, txnId } = req.body;
        const role = req.appRole;
        const query = {
            mobile,
            role,
            consumedAt: { $exists: false },
        };
        if (txnId) {
            query.txnId = txnId;
        }
        const session = await OtpSession_1.OtpSession.findOne(query).sort({ createdAt: -1 });
        if (!session) {
            throw new AppError_1.AppError(400, errorCodes_1.ERROR_CODES.OTP_INVALID, 'No active OTP request found for this mobile number');
        }
        if (session.expiresAt < new Date()) {
            throw new AppError_1.AppError(400, errorCodes_1.ERROR_CODES.OTP_EXPIRED, 'OTP has expired. Please request a new OTP.');
        }
        if (session.attempts >= env_1.env.OTP_MAX_ATTEMPTS) {
            throw new AppError_1.AppError(429, errorCodes_1.ERROR_CODES.OTP_ATTEMPTS_EXCEEDED, 'Maximum verification attempts exceeded. Please request a new OTP.');
        }
        const isMatch = await bcryptjs_1.default.compare(otp, session.otpHash);
        if (!isMatch) {
            session.attempts += 1;
            await session.save();
            throw new AppError_1.AppError(400, errorCodes_1.ERROR_CODES.OTP_INVALID, 'Invalid OTP. Please check and try again.');
        }
        // Mark consumed
        session.consumedAt = new Date();
        await session.save();
        if (role === 'user') {
            let user = await User_1.User.findOne({ mobile });
            const isNewUser = !user || !user.profileCompleted;
            if (!user) {
                user = await User_1.User.create({
                    mobile,
                    profileCompleted: false,
                    status: 'active',
                    lastLoginAt: new Date(),
                });
            }
            else {
                user.lastLoginAt = new Date();
                await user.save();
            }
            const { accessToken, refreshToken } = await token_service_1.tokenService.issueTokens(user._id, 'user');
            return res.status(200).json({
                token: accessToken,
                refreshToken,
                isNewUser,
                user: {
                    id: user._id.toString(),
                    name: user.name || null,
                    mobile: user.mobile,
                    district: user.district || null,
                    location: user.location || null,
                },
            });
        }
        // Provider role
        let provider = await Provider_1.Provider.findOne({ mobile });
        if (!provider) {
            provider = await Provider_1.Provider.create({
                mobile,
                status: 'draft',
                registrationStep: 1,
                completedSteps: [],
                rating: 0,
                reviewCount: 0,
            });
        }
        const { accessToken, refreshToken } = await token_service_1.tokenService.issueTokens(provider._id, 'provider');
        const providerData = {
            accessToken,
            refreshToken,
            provider: {
                id: provider._id.toString(),
                mobile: provider.mobile,
                status: provider.status,
                registrationStep: provider.registrationStep,
                businessName: provider.businessName || null,
            },
        };
        return respond_1.respond.ok(req, res, providerData, {
            message: 'Verified successfully',
        });
    },
    async resendOtp(req, res) {
        const { mobile } = req.body;
        const role = req.appRole;
        const latest = await OtpSession_1.OtpSession.findOne({ mobile, role }).sort({ createdAt: -1 });
        if (latest) {
            const diffSec = Math.floor((Date.now() - latest.lastSentAt.getTime()) / 1000);
            if (diffSec < env_1.env.OTP_RESEND_COOLDOWN_SECONDS) {
                const retryAfter = env_1.env.OTP_RESEND_COOLDOWN_SECONDS - diffSec;
                throw new AppError_1.AppError(429, errorCodes_1.ERROR_CODES.RATE_LIMITED, `Please wait ${retryAfter} seconds before resending OTP`);
            }
        }
        const otp = env_1.env.OTP_DEV_MODE ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();
        const otpHash = await bcryptjs_1.default.hash(otp, 10);
        const txnId = `txn_${crypto_1.default.randomBytes(12).toString('hex')}`;
        const expiresAt = new Date(Date.now() + env_1.env.OTP_TTL_SECONDS * 1000);
        await OtpSession_1.OtpSession.create({
            mobile,
            role,
            txnId,
            otpHash,
            attempts: 0,
            sendCount: 1,
            windowStartedAt: new Date(),
            lastSentAt: new Date(),
            expiresAt,
        });
        await sms_1.smsService.sendSms({
            toMobile: mobile,
            otp,
            message: `Your new Aagara Thirupthi verification code is ${otp}. Valid for 5 minutes.`,
        });
        if (role === 'provider') {
            return respond_1.respond.ok(req, res, {
                resend_available_in_seconds: env_1.env.OTP_RESEND_COOLDOWN_SECONDS,
            }, {
                message: 'New OTP sent successfully',
            });
        }
        return res.status(200).json({
            success: true,
            message: 'New OTP sent',
            txnId,
        });
    },
    async logout(req, res) {
        if (!req.auth) {
            throw new AppError_1.AppError(401, errorCodes_1.ERROR_CODES.UNAUTHORIZED, 'Authentication required');
        }
        if (req.auth.sid) {
            await token_service_1.tokenService.revokeSession(req.auth.sid);
        }
        const pushToken = req.body?.push_token || req.body?.pushToken;
        if (pushToken && req.auth.sub) {
            await Session_1.Session.updateMany({ subjectId: req.auth.sub, role: req.auth.role, pushToken }, { $unset: { pushToken: 1 } });
        }
        return respond_1.respond.message(req, res, 'Logged out successfully');
    },
    async refreshToken(req, res) {
        const rawToken = req.body.refreshToken || req.body.refresh_token;
        if (!rawToken) {
            throw new AppError_1.AppError(400, errorCodes_1.ERROR_CODES.VALIDATION_ERROR, 'refresh_token is required');
        }
        const tokens = await token_service_1.tokenService.rotateRefreshToken(rawToken);
        if (req.appRole === 'provider' || req.appRole === 'admin') {
            return respond_1.respond.ok(req, res, {
                accessToken: tokens.accessToken,
                refreshToken: tokens.refreshToken,
            });
        }
        return res.status(200).json({
            token: tokens.accessToken,
            refreshToken: tokens.refreshToken,
        });
    },
    async pushToken(req, res) {
        if (!req.auth) {
            throw new AppError_1.AppError(401, errorCodes_1.ERROR_CODES.UNAUTHORIZED, 'Authentication required');
        }
        const token = req.body.push_token || req.body.pushToken;
        if (!token) {
            throw new AppError_1.AppError(400, errorCodes_1.ERROR_CODES.VALIDATION_ERROR, 'push_token is required');
        }
        if (req.auth.sid) {
            await token_service_1.tokenService.registerPushToken(req.auth.sid, token);
        }
        return respond_1.respond.message(req, res, 'Push token registered successfully');
    },
};
