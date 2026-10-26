"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const AppError_1 = require("../errors/AppError");
const errorCodes_1 = require("../errors/errorCodes");
const logger_1 = require("@/config/logger");
function errorHandler(err, req, res, 
// eslint-disable-next-line @typescript-eslint/no-unused-vars
next) {
    const isProviderOrAdmin = req.appRole === 'provider' || req.appRole === 'admin';
    const requestId = req.id || req.headers['x-request-id'];
    let statusCode = 500;
    let code = errorCodes_1.ERROR_CODES.INTERNAL_ERROR;
    let message = 'An unexpected internal error occurred';
    let details = undefined;
    if (err instanceof AppError_1.AppError) {
        statusCode = err.statusCode;
        code = err.code;
        message = err.message;
        details = err.details;
    }
    else if (err.code === 11000) {
        statusCode = 409;
        code = errorCodes_1.ERROR_CODES.ALREADY_EXISTS;
        message = 'A record with this identifier already exists';
    }
    else if (err instanceof SyntaxError && 'body' in err) {
        statusCode = 400;
        code = errorCodes_1.ERROR_CODES.VALIDATION_ERROR;
        message = 'Malformed JSON request body';
    }
    else {
        logger_1.logger.error({ err, path: req.path, method: req.method }, 'Unhandled server error');
    }
    if (isProviderOrAdmin) {
        const errorPayload = {
            code,
            message,
        };
        if (details) {
            errorPayload.details = details;
        }
        if (requestId) {
            errorPayload.requestId = requestId;
        }
        return res.status(statusCode).json({
            success: false,
            error: errorPayload,
        });
    }
    // User error format
    const userPayload = {
        success: false,
        statusCode,
        code,
        message,
    };
    if (details) {
        userPayload.errors = details;
    }
    if (requestId) {
        userPayload.requestId = requestId;
    }
    return res.status(statusCode).json(userPayload);
}
