"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.tokenService = void 0;
exports.hashRefreshToken = hashRefreshToken;
exports.generateRefreshToken = generateRefreshToken;
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const mongoose_1 = __importDefault(require("mongoose"));
const env_1 = require("@/config/env");
const Session_1 = require("@/models/Session");
const AppError_1 = require("@/common/errors/AppError");
const errorCodes_1 = require("@/common/errors/errorCodes");
function hashRefreshToken(token) {
    return crypto_1.default.createHash('sha256').update(token).digest('hex');
}
function generateRefreshToken() {
    return crypto_1.default.randomBytes(48).toString('hex');
}
exports.tokenService = {
    async issueTokens(subjectId, role, deviceInfo, pushToken) {
        const rawRefreshToken = generateRefreshToken();
        const refreshHash = hashRefreshToken(rawRefreshToken);
        const expiresAt = new Date(Date.now() + env_1.env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
        const session = await Session_1.Session.create({
            subjectId: new mongoose_1.default.Types.ObjectId(subjectId),
            role,
            refreshHash,
            deviceInfo,
            pushToken,
            expiresAt,
        });
        const accessTtl = role === 'user' ? env_1.env.ACCESS_TOKEN_TTL_USER : env_1.env.ACCESS_TOKEN_TTL_PROVIDER;
        const accessToken = jsonwebtoken_1.default.sign({
            sub: subjectId.toString(),
            role,
            sid: session._id.toString(),
        }, env_1.env.JWT_ACCESS_SECRET, { expiresIn: accessTtl });
        return {
            accessToken,
            refreshToken: rawRefreshToken,
        };
    },
    async rotateRefreshToken(rawOldRefreshToken) {
        const oldHash = hashRefreshToken(rawOldRefreshToken);
        const session = await Session_1.Session.findOne({ refreshHash: oldHash });
        if (!session) {
            throw new AppError_1.AppError(401, errorCodes_1.ERROR_CODES.REFRESH_INVALID, 'Invalid or expired refresh token');
        }
        // Reuse detection
        if (session.revokedAt) {
            await Session_1.Session.deleteMany({ subjectId: session.subjectId, role: session.role });
            throw new AppError_1.AppError(401, errorCodes_1.ERROR_CODES.REFRESH_INVALID, 'Suspicious refresh token reuse detected. All sessions terminated.');
        }
        if (session.expiresAt < new Date()) {
            throw new AppError_1.AppError(401, errorCodes_1.ERROR_CODES.TOKEN_EXPIRED, 'Refresh token has expired');
        }
        const rawNewRefreshToken = generateRefreshToken();
        const newHash = hashRefreshToken(rawNewRefreshToken);
        session.refreshHash = newHash;
        session.expiresAt = new Date(Date.now() + env_1.env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
        await session.save();
        const accessTtl = session.role === 'user' ? env_1.env.ACCESS_TOKEN_TTL_USER : env_1.env.ACCESS_TOKEN_TTL_PROVIDER;
        const accessToken = jsonwebtoken_1.default.sign({
            sub: session.subjectId.toString(),
            role: session.role,
            sid: session._id.toString(),
        }, env_1.env.JWT_ACCESS_SECRET, { expiresIn: accessTtl });
        return {
            accessToken,
            refreshToken: rawNewRefreshToken,
        };
    },
    async revokeSession(sessionId) {
        await Session_1.Session.findByIdAndUpdate(sessionId, { revokedAt: new Date() });
    },
    async registerPushToken(sessionId, pushToken) {
        await Session_1.Session.findByIdAndUpdate(sessionId, { pushToken });
    },
};
