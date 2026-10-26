"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminLoginLimiter = exports.sendOtpIpLimiter = exports.globalLimiter = void 0;
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const AppError_1 = require("../errors/AppError");
const errorCodes_1 = require("../errors/errorCodes");
exports.globalLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    handler: () => {
        throw new AppError_1.AppError(429, errorCodes_1.ERROR_CODES.RATE_LIMITED, 'Too many requests, please try again later');
    },
});
exports.sendOtpIpLimiter = (0, express_rate_limit_1.default)({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    handler: () => {
        throw new AppError_1.AppError(429, errorCodes_1.ERROR_CODES.RATE_LIMITED, 'Too many OTP requests from this IP, please try again after an hour');
    },
});
exports.adminLoginLimiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    handler: () => {
        throw new AppError_1.AppError(429, errorCodes_1.ERROR_CODES.RATE_LIMITED, 'Too many admin login attempts, please try again later');
    },
});
