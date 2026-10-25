import { beforeAll } from 'vitest';

beforeAll(() => {
  process.env.NODE_ENV = 'test';
  process.env.PORT = '5001';
  process.env.JWT_ACCESS_SECRET = 'test_access_secret_super_secure_key_1234567890';
  process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_super_secure_key_1234567890';
  process.env.DOC_ENCRYPTION_KEY = 'c29tZXNlY3JldGtleWZvcmFlc2djbTI1NmJpdGtleSE=';
  process.env.OTP_DEV_MODE = 'true';
  process.env.STORAGE_DRIVER = 'local';
  process.env.ALLOW_EXTERNAL_IMAGE_URLS = 'true';
});
