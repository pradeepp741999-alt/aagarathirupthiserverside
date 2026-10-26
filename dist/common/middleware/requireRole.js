"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = requireRole;
const AppError_1 = require("../errors/AppError");
const errorCodes_1 = require("../errors/errorCodes");
function requireRole(allowedRole) {
    const roles = Array.isArray(allowedRole) ? allowedRole : [allowedRole];
    return (req, res, next) => {
        if (!req.auth) {
            return next(new AppError_1.AppError(401, errorCodes_1.ERROR_CODES.UNAUTHORIZED, 'Authentication required'));
        }
        if (!roles.includes(req.auth.role)) {
            return next(new AppError_1.AppError(403, errorCodes_1.ERROR_CODES.FORBIDDEN, `Access forbidden for role: ${req.auth.role}`));
        }
        next();
    };
}
