import { z } from 'zod';

export const sendOtpSchema = z
  .object({
    mobile: z
      .string()
      .optional()
      .transform((val) => (val ? val.replace(/\D/g, '').slice(-10) : undefined))
      .refine((val) => !val || /^[6-9]\d{9}$/.test(val), {
        message: 'Mobile must be a valid 10-digit Indian phone number starting with 6-9',
      }),
    email: z.string().trim().email('Invalid email address').optional(),
  })
  .refine((data) => data.mobile || data.email, {
    message: 'Either mobile number or email address is required',
  })
  .passthrough();

export const verifyOtpSchema = z
  .object({
    mobile: z
      .string()
      .optional()
      .transform((val) => (val ? val.replace(/\D/g, '').slice(-10) : undefined))
      .refine((val) => !val || /^[6-9]\d{9}$/.test(val), {
        message: 'Invalid 10-digit mobile number',
      }),
    email: z.string().trim().email('Invalid email address').optional(),
    otp: z.string().trim().length(6, 'OTP must be 6 digits'),
    txnId: z.string().optional(),
  })
  .refine((data) => data.mobile || data.email, {
    message: 'Either mobile number or email address is required',
  })
  .passthrough();

export const resendOtpSchema = sendOtpSchema;

export const refreshTokenSchema = z
  .object({
    refreshToken: z.string().optional(),
    refresh_token: z.string().optional(),
  })
  .refine((data) => data.refreshToken || data.refresh_token, {
    message: 'refresh_token is required',
  });

export const pushTokenSchema = z
  .object({
    pushToken: z.string().optional(),
    push_token: z.string().optional(),
    device: z.string().optional(),
  })
  .passthrough();
