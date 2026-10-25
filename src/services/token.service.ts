import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { env } from '@/config/env';
import { AppRole } from '@/config/constants';
import { Session } from '@/models/Session';
import { AppError } from '@/common/errors/AppError';
import { ERROR_CODES } from '@/common/errors/errorCodes';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString('hex');
}

export const tokenService = {
  async issueTokens(
    subjectId: string | mongoose.Types.ObjectId,
    role: AppRole,
    deviceInfo?: string,
    pushToken?: string
  ): Promise<TokenPair> {
    const rawRefreshToken = generateRefreshToken();
    const refreshHash = hashRefreshToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    const session = await Session.create({
      subjectId: new mongoose.Types.ObjectId(subjectId),
      role,
      refreshHash,
      deviceInfo,
      pushToken,
      expiresAt,
    });

    const accessTtl = role === 'user' ? env.ACCESS_TOKEN_TTL_USER : env.ACCESS_TOKEN_TTL_PROVIDER;

    const accessToken = jwt.sign(
      {
        sub: subjectId.toString(),
        role,
        sid: session._id.toString(),
      },
      env.JWT_ACCESS_SECRET,
      { expiresIn: accessTtl } as jwt.SignOptions
    );

    return {
      accessToken,
      refreshToken: rawRefreshToken,
    };
  },

  async rotateRefreshToken(rawOldRefreshToken: string): Promise<TokenPair> {
    const oldHash = hashRefreshToken(rawOldRefreshToken);

    const session = await Session.findOne({ refreshHash: oldHash });

    if (!session) {
      throw new AppError(401, ERROR_CODES.REFRESH_INVALID, 'Invalid or expired refresh token');
    }

    // Reuse detection
    if (session.revokedAt) {
      await Session.deleteMany({ subjectId: session.subjectId, role: session.role });
      throw new AppError(
        401,
        ERROR_CODES.REFRESH_INVALID,
        'Suspicious refresh token reuse detected. All sessions terminated.'
      );
    }

    if (session.expiresAt < new Date()) {
      throw new AppError(401, ERROR_CODES.TOKEN_EXPIRED, 'Refresh token has expired');
    }

    const rawNewRefreshToken = generateRefreshToken();
    const newHash = hashRefreshToken(rawNewRefreshToken);

    session.refreshHash = newHash;
    session.expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
    await session.save();

    const accessTtl = session.role === 'user' ? env.ACCESS_TOKEN_TTL_USER : env.ACCESS_TOKEN_TTL_PROVIDER;

    const accessToken = jwt.sign(
      {
        sub: session.subjectId.toString(),
        role: session.role,
        sid: session._id.toString(),
      },
      env.JWT_ACCESS_SECRET,
      { expiresIn: accessTtl } as jwt.SignOptions
    );

    return {
      accessToken,
      refreshToken: rawNewRefreshToken,
    };
  },

  async revokeSession(sessionId: string): Promise<void> {
    await Session.findByIdAndUpdate(sessionId, { revokedAt: new Date() });
  },

  async registerPushToken(sessionId: string, pushToken: string): Promise<void> {
    await Session.findByIdAndUpdate(sessionId, { pushToken });
  },
};
