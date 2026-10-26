import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  API_BASE_URL: z.string().url().default('http://localhost:4000'),
  MONGODB_URI: z.string().min(1).default('mongodb://localhost:27017/aagara?replicaSet=rs0'),
  SYNC_INDEXES: z.enum(['true', 'false']).default('true').transform((val) => val === 'true'),

  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  ACCESS_TOKEN_TTL_PROVIDER: z.string().default('15m'),
  ACCESS_TOKEN_TTL_USER: z.string().default('30d'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),

  DOC_ENCRYPTION_KEY: z.string().min(32, 'DOC_ENCRYPTION_KEY must be at least 32 characters (base64 32 bytes)'),

  CORS_ORIGINS: z.string().default('*').transform((val) => (val === '*' ? ['*'] : val.split(',').map((s) => s.trim()))),

  OTP_DEV_MODE: z.enum(['true', 'false']).default('true').transform((val) => val === 'true'),
  OTP_TTL_SECONDS: z.coerce.number().default(300),
  OTP_RESEND_COOLDOWN_SECONDS: z.coerce.number().default(30),
  OTP_MAX_SENDS: z.coerce.number().default(3),
  OTP_WINDOW_MINUTES: z.coerce.number().default(15),
  OTP_MAX_ATTEMPTS: z.coerce.number().default(5),

  SMS_DRIVER: z.enum(['console', 'msg91', 'fast2sms', 'twilio']).default('console'),
  SMS_NOTIFY_QUOTES: z.enum(['true', 'false']).default('false').transform((val) => val === 'true'),

  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  LOCAL_UPLOAD_DIR: z.string().default('./uploads'),
  CDN_BASE_URL: z.string().default('http://localhost:4000/static/uploads'),
  ALLOW_EXTERNAL_IMAGE_URLS: z.enum(['true', 'false']).default('false').transform((val) => val === 'true'),

  S3_BUCKET: z.string().optional().default(''),
  S3_REGION: z.string().optional().default('ap-south-1'),
  S3_ENDPOINT: z.string().optional().default(''),
  S3_ACCESS_KEY_ID: z.string().optional().default(''),
  S3_SECRET_ACCESS_KEY: z.string().optional().default(''),

  EXPO_ACCESS_TOKEN: z.string().optional().default(''),

  ADMIN_EMAIL: z.string().email().default('admin@aagarathirupthi.com'),
  ADMIN_PASSWORD: z.string().min(8).default('Admin@Aagara2026!'),

  PLATFORM_COMMISSION_PERCENT: z.coerce.number().default(0),
  JOBS_ENABLED: z.enum(['true', 'false']).default('true').transform((val) => val === 'true'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:', JSON.stringify(parsed.error.format(), null, 2));
  process.exit(1);
}

if (parsed.data.NODE_ENV === 'production' && parsed.data.OTP_DEV_MODE) {
  console.warn('⚠️ WARNING: OTP_DEV_MODE is enabled in production environment (demo OTP 123456 is active).');
}

export const env = parsed.data;
