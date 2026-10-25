import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { env } from '@/config/env';
import { MediaUpload } from '@/models/MediaUpload';
import { StorageDriver, UploadUrlOptions, UploadUrlResult } from './index';
import { logger } from '@/config/logger';

export const localStorageDriver: StorageDriver = {
  async getUploadUrl(opts: UploadUrlOptions): Promise<UploadUrlResult> {
    const localToken = crypto.randomBytes(24).toString('hex');
    const uploadUrl = `${env.API_BASE_URL}/api/v1/media/local-upload/${localToken}`;
    const fileUrl = `${env.CDN_BASE_URL}/${opts.key}`;

    await MediaUpload.findOneAndUpdate(
      { key: opts.key },
      {
        ownerRole: opts.ownerRole,
        ownerId: opts.ownerId,
        category: opts.category,
        key: opts.key,
        fileUrl,
        mimeType: opts.mimeType,
        status: 'pending',
        localToken,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 mins
      },
      { upsert: true, new: true }
    );

    return { uploadUrl, fileUrl };
  },

  async deleteFile(fileUrl: string): Promise<void> {
    const relativePath = fileUrl.replace(env.CDN_BASE_URL, '').replace(/^\//, '');
    const fullPath = path.resolve(env.LOCAL_UPLOAD_DIR, relativePath);

    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
      } catch (err) {
        logger.warn({ err, fullPath }, 'Failed to delete local file');
      }
    }
  },
};
