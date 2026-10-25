import { env } from '@/config/env';
import { MediaUpload } from '@/models/MediaUpload';
import { AppError } from '@/common/errors/AppError';
import { ERROR_CODES } from '@/common/errors/errorCodes';
import { localStorageDriver } from './local';
import { s3StorageDriver } from './s3';

export interface UploadUrlOptions {
  key: string;
  mimeType: string;
  category: string;
  ownerId: string;
  ownerRole: string;
}

export interface UploadUrlResult {
  uploadUrl: string;
  fileUrl: string;
}

export interface StorageDriver {
  getUploadUrl(opts: UploadUrlOptions): Promise<UploadUrlResult>;
  deleteFile(fileUrl: string): Promise<void>;
}

export const storage: StorageDriver & {
  assertOwned(fileUrl: string, owner: { ownerRole: string; ownerId: string }): Promise<void>;
} = {
  async getUploadUrl(opts: UploadUrlOptions): Promise<UploadUrlResult> {
    if (env.STORAGE_DRIVER === 's3') {
      return s3StorageDriver.getUploadUrl(opts);
    }
    return localStorageDriver.getUploadUrl(opts);
  },

  async deleteFile(fileUrl: string): Promise<void> {
    if (env.STORAGE_DRIVER === 's3') {
      return s3StorageDriver.deleteFile(fileUrl);
    }
    return localStorageDriver.deleteFile(fileUrl);
  },

  async assertOwned(fileUrl: string, owner: { ownerRole: string; ownerId: string }): Promise<void> {
    // If dev external images allowed and starts with http(s) not on our CDN
    if (env.ALLOW_EXTERNAL_IMAGE_URLS && !fileUrl.startsWith(env.CDN_BASE_URL)) {
      return;
    }

    if (!fileUrl.startsWith(env.CDN_BASE_URL)) {
      throw new AppError(422, ERROR_CODES.INVALID_FILE_URL, `File URL must start with ${env.CDN_BASE_URL}`);
    }

    const upload = await MediaUpload.findOne({
      fileUrl,
      ownerRole: owner.ownerRole,
      ownerId: owner.ownerId,
    });

    if (!upload) {
      throw new AppError(
        422,
        ERROR_CODES.INVALID_FILE_URL,
        'File URL was not registered or belongs to a different account'
      );
    }

    // Mark status uploaded
    if (upload.status === 'pending') {
      upload.status = 'uploaded';
      await upload.save();
    }
  },
};
