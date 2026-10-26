"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.byRole = byRole;
const AppError_1 = require("../errors/AppError");
const errorCodes_1 = require("../errors/errorCodes");
function byRole(handlers) {
    return (req, res, next) => {
        const role = req.auth?.role || req.appRole;
        if (!role) {
            return next(new AppError_1.AppError(400, errorCodes_1.ERROR_CODES.ROLE_REQUIRED, 'Unable to determine app role'));
        }
        const handler = handlers[role];
        if (!handler) {
            return next(new AppError_1.AppError(403, errorCodes_1.ERROR_CODES.ROLE_MISMATCH, `This action is not supported for role: ${role}`));
        }
        return handler(req, res, next);
    };
}
