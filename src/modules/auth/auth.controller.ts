import { Request, Response } from 'express';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { env } from '@/config/env';
import { OtpSession } from '@/models/OtpSession';
import { User } from '@/models/User';
import { Provider } from '@/models/Provider';
import { Session } from '@/models/Session';
import { smsService } from '@/services/sms';
import { tokenService } from '@/services/token.service';
import { respond } from '@/common/http/respond';
import { AppError } from '@/common/errors/AppError';
import { ERROR_CODES } from '@/common/errors/errorCodes';

export const authController = {
  async sendOtp(req: Request, res: Response) {
    const { mobile } = req.body;
    const role = req.appRole!;

    // Check recent sessions in rate limit window
    const windowStart = new Date(Date.now() - env.OTP_WINDOW_MINUTES * 60 * 1000);
    const recentSessions = await OtpSession.find({
      mobile,
      role,
      createdAt: { $gte: windowStart },
    }).sort({ createdAt: -1 });

    if (recentSessions.length >= env.OTP_MAX_SENDS) {
      throw new AppError(
        429,
        ERROR_CODES.RATE_LIMITED,
        `Maximum ${env.OTP_MAX_SENDS} OTP requests allowed per ${env.OTP_WINDOW_MINUTES} minutes. Please try again later.`
      );
    }

    if (recentSessions.length > 0) {
      const lastSentAt = recentSessions[0].lastSentAt.getTime();
      const diffSec = Math.floor((Date.now() - lastSentAt) / 1000);
      if (diffSec < env.OTP_RESEND_COOLDOWN_SECONDS) {
        const retryAfterSeconds = env.OTP_RESEND_COOLDOWN_SECONDS - diffSec;
        throw new AppError(
          429,
          ERROR_CODES.RATE_LIMITED,
          `Please wait ${retryAfterSeconds} seconds before requesting a new OTP.`
        );
      }
    }

    const otp = env.OTP_DEV_MODE ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    const txnId = `txn_${crypto.randomBytes(12).toString('hex')}`;
    const expiresAt = new Date(Date.now() + env.OTP_TTL_SECONDS * 1000);

    await OtpSession.create({
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

    await smsService.sendSms({
      toMobile: mobile,
      otp,
      message: `Your Aagara Thirupthi verification code is ${otp}. Valid for 5 minutes. Do not share it.`,
    });

    if (role === 'provider') {
      return respond.ok(
        req,
        res,
        {
          mobile,
          expires_in_seconds: env.OTP_TTL_SECONDS,
          resend_available_in_seconds: env.OTP_RESEND_COOLDOWN_SECONDS,
        },
        {
          message: `OTP sent successfully to +91 ${mobile}`,
        }
      );
    }

    // User response
    return res.status(200).json({
      success: true,
      message: 'OTP sent successfully',
      txnId,
      expiresInSeconds: env.OTP_TTL_SECONDS,
    });
  },

  async verifyOtp(req: Request, res: Response) {
    const { mobile, otp, txnId } = req.body;
    const role = req.appRole!;

    const query: Record<string, unknown> = {
      mobile,
      role,
      consumedAt: { $exists: false },
    };
    if (txnId) {
      query.txnId = txnId;
    }

    const session = await OtpSession.findOne(query).sort({ createdAt: -1 });

    if (!session) {
      throw new AppError(400, ERROR_CODES.OTP_INVALID, 'No active OTP request found for this mobile number');
    }

    if (session.expiresAt < new Date()) {
      throw new AppError(400, ERROR_CODES.OTP_EXPIRED, 'OTP has expired. Please request a new OTP.');
    }

    if (session.attempts >= env.OTP_MAX_ATTEMPTS) {
      throw new AppError(
        429,
        ERROR_CODES.OTP_ATTEMPTS_EXCEEDED,
        'Maximum verification attempts exceeded. Please request a new OTP.'
      );
    }

    const isMatch = await bcrypt.compare(otp, session.otpHash);
    if (!isMatch) {
      session.attempts += 1;
      await session.save();
      throw new AppError(400, ERROR_CODES.OTP_INVALID, 'Invalid OTP. Please check and try again.');
    }

    // Mark consumed
    session.consumedAt = new Date();
    await session.save();

    if (role === 'user') {
      let user = await User.findOne({ mobile });
      const isNewUser = !user || !user.profileCompleted;

      if (!user) {
        user = await User.create({
          mobile,
          profileCompleted: false,
          status: 'active',
          lastLoginAt: new Date(),
        });
      } else {
        user.lastLoginAt = new Date();
        await user.save();
      }

      const { accessToken, refreshToken } = await tokenService.issueTokens(user._id, 'user');

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
    let provider = await Provider.findOne({ mobile });
    if (!provider) {
      provider = await Provider.create({
        mobile,
        status: 'draft',
        registrationStep: 1,
        completedSteps: [],
        rating: 0,
        reviewCount: 0,
      });
    }

    const { accessToken, refreshToken } = await tokenService.issueTokens(provider._id, 'provider');

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

    return respond.ok(req, res, providerData, {
      message: 'Verified successfully',
    });
  },

  async resendOtp(req: Request, res: Response) {
    const { mobile } = req.body;
    const role = req.appRole!;

    const latest = await OtpSession.findOne({ mobile, role }).sort({ createdAt: -1 });
    if (latest) {
      const diffSec = Math.floor((Date.now() - latest.lastSentAt.getTime()) / 1000);
      if (diffSec < env.OTP_RESEND_COOLDOWN_SECONDS) {
        const retryAfter = env.OTP_RESEND_COOLDOWN_SECONDS - diffSec;
        throw new AppError(429, ERROR_CODES.RATE_LIMITED, `Please wait ${retryAfter} seconds before resending OTP`);
      }
    }

    const otp = env.OTP_DEV_MODE ? '123456' : Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await bcrypt.hash(otp, 10);
    const txnId = `txn_${crypto.randomBytes(12).toString('hex')}`;
    const expiresAt = new Date(Date.now() + env.OTP_TTL_SECONDS * 1000);

    await OtpSession.create({
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

    await smsService.sendSms({
      toMobile: mobile,
      otp,
      message: `Your new Aagara Thirupthi verification code is ${otp}. Valid for 5 minutes.`,
    });

    if (role === 'provider') {
      return respond.ok(
        req,
        res,
        {
          resend_available_in_seconds: env.OTP_RESEND_COOLDOWN_SECONDS,
        },
        {
          message: 'New OTP sent successfully',
        }
      );
    }

    return res.status(200).json({
      success: true,
      message: 'New OTP sent',
      txnId,
    });
  },

  async logout(req: Request, res: Response) {
    if (!req.auth) {
      throw new AppError(401, ERROR_CODES.UNAUTHORIZED, 'Authentication required');
    }

    if (req.auth.sid) {
      await tokenService.revokeSession(req.auth.sid);
    }

    const pushToken = req.body?.push_token || req.body?.pushToken;
    if (pushToken && req.auth.sub) {
      await Session.updateMany(
        { subjectId: req.auth.sub, role: req.auth.role, pushToken },
        { $unset: { pushToken: 1 } }
      );
    }

    return respond.message(req, res, 'Logged out successfully');
  },

  async refreshToken(req: Request, res: Response) {
    const rawToken = req.body.refreshToken || req.body.refresh_token;
    if (!rawToken) {
      throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'refresh_token is required');
    }

    const tokens = await tokenService.rotateRefreshToken(rawToken);

    if (req.appRole === 'provider' || req.appRole === 'admin') {
      return respond.ok(req, res, {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      });
    }

    return res.status(200).json({
      token: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  },

  async pushToken(req: Request, res: Response) {
    if (!req.auth) {
      throw new AppError(401, ERROR_CODES.UNAUTHORIZED, 'Authentication required');
    }

    const token = req.body.push_token || req.body.pushToken;
    if (!token) {
      throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, 'push_token is required');
    }

    if (req.auth.sid) {
      await tokenService.registerPushToken(req.auth.sid, token);
    }

    return respond.message(req, res, 'Push token registered successfully');
  },
};
