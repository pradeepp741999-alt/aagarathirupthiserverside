"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
const dotenv_1 = __importDefault(require("dotenv"));
const zod_1 = require("zod");
dotenv_1.default.config();
const envSchema = zod_1.z.object({
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    PORT: zod_1.z.coerce.number().default(4000),
    API_BASE_URL: zod_1.z.string().url().default('http://localhost:4000'),
    MONGODB_URI: zod_1.z.string().min(1).default('mongodb://localhost:27017/aagara?replicaSet=rs0'),
    SYNC_INDEXES: zod_1.z.enum(['true', 'false']).default('true').transform((val) => val === 'true'),
    JWT_ACCESS_SECRET: zod_1.z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    JWT_REFRESH_SECRET: zod_1.z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
    ACCESS_TOKEN_TTL_PROVIDER: zod_1.z.string().default('15m'),
    ACCESS_TOKEN_TTL_USER: zod_1.z.string().default('30d'),
    REFRESH_TOKEN_TTL_DAYS: zod_1.z.coerce.number().default(30),
    DOC_ENCRYPTION_KEY: zod_1.z.string().min(32, 'DOC_ENCRYPTION_KEY must be at least 32 characters (base64 32 bytes)'),
    CORS_ORIGINS: zod_1.z.string().default('*').transform((val) => (val === '*' ? ['*'] : val.split(',').map((s) => s.trim()))),
    OTP_DEV_MODE: zod_1.z.enum(['true', 'false']).default('true').transform((val) => val === 'true'),
    OTP_TTL_SECONDS: zod_1.z.coerce.number().default(300),
    OTP_RESEND_COOLDOWN_SECONDS: zod_1.z.coerce.number().default(30),
    OTP_MAX_SENDS: zod_1.z.coerce.number().default(3),
    OTP_WINDOW_MINUTES: zod_1.z.coerce.number().default(15),
    OTP_MAX_ATTEMPTS: zod_1.z.coerce.number().default(5),
    SMS_DRIVER: zod_1.z.enum(['console', 'msg91', 'fast2sms', 'twilio']).default('console'),
    SMS_NOTIFY_QUOTES: zod_1.z.enum(['true', 'false']).default('false').transform((val) => val === 'true'),
    STORAGE_DRIVER: zod_1.z.enum(['local', 's3']).default('local'),
    LOCAL_UPLOAD_DIR: zod_1.z.string().default('./uploads'),
    CDN_BASE_URL: zod_1.z.string().default('http://localhost:4000/static/uploads'),
    ALLOW_EXTERNAL_IMAGE_URLS: zod_1.z.enum(['true', 'false']).default('false').transform((val) => val === 'true'),
    S3_BUCKET: zod_1.z.string().optional().default(''),
    S3_REGION: zod_1.z.string().optional().default('ap-south-1'),
    S3_ENDPOINT: zod_1.z.string().optional().default(''),
    S3_ACCESS_KEY_ID: zod_1.z.string().optional().default(''),
    S3_SECRET_ACCESS_KEY: zod_1.z.string().optional().default(''),
    EXPO_ACCESS_TOKEN: zod_1.z.string().optional().default(''),
    ADMIN_EMAIL: zod_1.z.string().email().default('admin@aagarathirupthi.com'),
    ADMIN_PASSWORD: zod_1.z.string().min(8).default('Admin@Aagara2026!'),
    PLATFORM_COMMISSION_PERCENT: zod_1.z.coerce.number().default(0),
    JOBS_ENABLED: zod_1.z.enum(['true', 'false']).default('true').transform((val) => val === 'true'),
    LOG_LEVEL: zod_1.z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});
const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
    console.error('❌ Invalid environment configuration:', JSON.stringify(parsed.error.format(), null, 2));
    process.exit(1);
}
if (parsed.data.NODE_ENV === 'production' && parsed.data.OTP_DEV_MODE) {
    console.error('❌ FATAL: OTP_DEV_MODE must NOT be enabled in production environment!');
    process.exit(1);
}
exports.env = parsed.data;
