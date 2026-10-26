"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("@/config/env");
const AppError_1 = require("../errors/AppError");
const errorCodes_1 = require("../errors/errorCodes");
const User_1 = require("@/models/User");
const Provider_1 = require("@/models/Provider");
async function authenticate(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(new AppError_1.AppError(401, errorCodes_1.ERROR_CODES.UNAUTHORIZED, 'Authorization Bearer token required'));
    }
    const token = authHeader.slice(7).trim();
    try {
        const decoded = jsonwebtoken_1.default.verify(token, env_1.env.JWT_ACCESS_SECRET);
        if (!decoded || !decoded.sub || !decoded.role) {
            return next(new AppError_1.AppError(401, errorCodes_1.ERROR_CODES.UNAUTHORIZED, 'Invalid token payload'));
        }
        // Role mismatch check if X-App-Role was provided
        if (req.appRole && req.appRole !== decoded.role) {
            return next(new AppError_1.AppError(403, errorCodes_1.ERROR_CODES.ROLE_MISMATCH, 'X-App-Role header does not match authenticated token role'));
        }
        // Check account status
        if (decoded.role === 'user') {
            const user = await User_1.User.findById(decoded.sub).select('status').lean();
            if (!user) {
                return next(new AppError_1.AppError(401, errorCodes_1.ERROR_CODES.UNAUTHORIZED, 'User account no longer exists'));
            }
            if (user.status === 'blocked') {
                return next(new AppError_1.AppError(403, errorCodes_1.ERROR_CODES.ACCOUNT_DISABLED, 'Your account has been disabled'));
            }
        }
        else if (decoded.role === 'provider') {
            const provider = await Provider_1.Provider.findById(decoded.sub).select('status isActive').lean();
            if (!provider) {
                return next(new AppError_1.AppError(401, errorCodes_1.ERROR_CODES.UNAUTHORIZED, 'Provider account no longer exists'));
            }
            if (provider.status === 'suspended' || provider.isActive === false) {
                return next(new AppError_1.AppError(403, errorCodes_1.ERROR_CODES.ACCOUNT_DISABLED, 'Provider account has been suspended or disabled'));
            }
        }
        req.auth = decoded;
        req.appRole = decoded.role;
        next();
    }
    catch (err) {
        if (err.name === 'TokenExpiredError') {
            return next(new AppError_1.AppError(401, errorCodes_1.ERROR_CODES.TOKEN_EXPIRED, 'Access token has expired'));
        }
        return next(new AppError_1.AppError(401, errorCodes_1.ERROR_CODES.UNAUTHORIZED, 'Invalid or corrupted access token'));
    }
}
