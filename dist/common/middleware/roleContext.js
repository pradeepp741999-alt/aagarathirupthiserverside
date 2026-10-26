"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.roleContext = roleContext;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const env_1 = require("@/config/env");
const AppError_1 = require("../errors/AppError");
const errorCodes_1 = require("../errors/errorCodes");
const constants_1 = require("@/config/constants");
function roleContext(req, res, next) {
    // Allow browser CORS preflight requests without requiring X-App-Role
    if (req.method === 'OPTIONS') {
        return next();
    }
    const headerRole = req.headers['x-app-role'];
    const authHeader = req.headers.authorization;
    let verifiedTokenRole;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7).trim();
        try {
            const decoded = jsonwebtoken_1.default.verify(token, env_1.env.JWT_ACCESS_SECRET);
            if (decoded && decoded.role) {
                verifiedTokenRole = decoded.role;
            }
        }
        catch {
            // Ignored here; authentication middleware will reject if route requires auth
        }
    }
    let resolvedRole;
    // 1. Header role validation
    let normalizedHeaderRole;
    if (headerRole && constants_1.APP_ROLES.includes(headerRole.toLowerCase())) {
        normalizedHeaderRole = headerRole.toLowerCase();
    }
    // 2. Token role check & mismatch enforcement
    if (verifiedTokenRole) {
        if (normalizedHeaderRole && normalizedHeaderRole !== verifiedTokenRole) {
            throw new AppError_1.AppError(403, errorCodes_1.ERROR_CODES.ROLE_MISMATCH, 'X-App-Role does not match authenticated token role');
        }
        resolvedRole = verifiedTokenRole;
    }
    else if (normalizedHeaderRole) {
        resolvedRole = normalizedHeaderRole;
    }
    // 3. Fallback logic
    if (!resolvedRole) {
        const isAuthRoute = req.path.includes('/auth') && !req.path.includes('/admin');
        if (isAuthRoute) {
            throw new AppError_1.AppError(400, errorCodes_1.ERROR_CODES.ROLE_REQUIRED, 'X-App-Role header (user|provider) is required for auth endpoints');
        }
        // Admin routes default to admin if under /admin
        if (req.path.includes('/admin')) {
            resolvedRole = 'admin';
        }
        else {
            resolvedRole = 'user';
        }
    }
    req.appRole = resolvedRole;
    next();
}
