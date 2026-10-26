"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pushTokenSchema = exports.refreshTokenSchema = exports.resendOtpSchema = exports.verifyOtpSchema = exports.sendOtpSchema = void 0;
const zod_1 = require("zod");
exports.sendOtpSchema = zod_1.z.object({
    mobile: zod_1.z
        .string()
        .transform((val) => val.replace(/\D/g, '').slice(-10))
        .refine((val) => /^[6-9]\d{9}$/.test(val), {
        message: 'Mobile must be a valid 10-digit Indian phone number starting with 6-9',
    }),
});
exports.verifyOtpSchema = zod_1.z
    .object({
    mobile: zod_1.z
        .string()
        .transform((val) => val.replace(/\D/g, '').slice(-10))
        .refine((val) => /^[6-9]\d{9}$/.test(val), {
        message: 'Invalid 10-digit mobile number',
    }),
    otp: zod_1.z.string().trim().length(6, 'OTP must be 6 digits'),
    txnId: zod_1.z.string().optional(),
})
    .passthrough();
exports.resendOtpSchema = exports.sendOtpSchema;
exports.refreshTokenSchema = zod_1.z
    .object({
    refreshToken: zod_1.z.string().optional(),
    refresh_token: zod_1.z.string().optional(),
})
    .refine((data) => data.refreshToken || data.refresh_token, {
    message: 'refresh_token is required',
});
exports.pushTokenSchema = zod_1.z
    .object({
    pushToken: zod_1.z.string().optional(),
    push_token: zod_1.z.string().optional(),
    device: zod_1.z.string().optional(),
})
    .passthrough();
