"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFound = notFound;
const AppError_1 = require("../errors/AppError");
const errorCodes_1 = require("../errors/errorCodes");
function notFound(req, res, next) {
    next(new AppError_1.AppError(404, errorCodes_1.ERROR_CODES.NOT_FOUND, `Route not found: ${req.method} ${req.originalUrl}`));
}
