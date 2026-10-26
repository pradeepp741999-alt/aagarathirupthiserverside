"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.optionalAuth = optionalAuth;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("@/config/env");
const User_1 = require("@/models/User");
const Provider_1 = require("@/models/Provider");
async function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next();
    }
    const token = authHeader.slice(7).trim();
    try {
        const decoded = jsonwebtoken_1.default.verify(token, env_1.env.JWT_ACCESS_SECRET);
        if (decoded && decoded.sub && decoded.role) {
            if (decoded.role === 'user') {
                const user = await User_1.User.findById(decoded.sub).select('status').lean();
                if (user && user.status !== 'blocked') {
                    req.auth = decoded;
                    req.appRole = decoded.role;
                }
            }
            else if (decoded.role === 'provider') {
                const provider = await Provider_1.Provider.findById(decoded.sub).select('status isActive').lean();
                if (provider && provider.status !== 'suspended' && provider.isActive !== false) {
                    req.auth = decoded;
                    req.appRole = decoded.role;
                }
            }
            else if (decoded.role === 'admin') {
                req.auth = decoded;
                req.appRole = decoded.role;
            }
        }
    }
    catch {
        // Gracefully ignore token errors on optional auth
    }
    next();
}
