import { z } from 'zod';

export const sendOtpSchema = z.object({
  mobile: z
    .string()
    .transform((val) => val.replace(/\D/g, '').slice(-10))
    .refine((val) => /^[6-9]\d{9}$/.test(val), {
      message: 'Mobile must be a valid 10-digit Indian phone number starting with 6-9',
    }),
});

export const verifyOtpSchema = z
  .object({
    mobile: z
      .string()
      .transform((val) => val.replace(/\D/g, '').slice(-10))
      .refine((val) => /^[6-9]\d{9}$/.test(val), {
        message: 'Invalid 10-digit mobile number',
      }),
    otp: z.string().trim().length(6, 'OTP must be 6 digits'),
    txnId: z.string().optional(),
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
