import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '@/config/env';
import { MediaUpload } from '@/models/MediaUpload';
import { StorageDriver, UploadUrlOptions, UploadUrlResult } from './index';

let s3ClientInstance: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3ClientInstance) {
    s3ClientInstance = new S3Client({
      region: env.S3_REGION || 'ap-south-1',
      endpoint: env.S3_ENDPOINT || undefined,
      credentials:
        env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
          ? {
              accessKeyId: env.S3_ACCESS_KEY_ID,
              secretAccessKey: env.S3_SECRET_ACCESS_KEY,
            }
          : undefined,
    });
  }
  return s3ClientInstance;
}

export const s3StorageDriver: StorageDriver = {
  async getUploadUrl(opts: UploadUrlOptions): Promise<UploadUrlResult> {
    const s3 = getS3Client();
    const command = new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: opts.key,
      ContentType: opts.mimeType,
    });

    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 });
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
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
      { upsert: true, new: true }
    );

    return { uploadUrl, fileUrl };
  },

  async deleteFile(fileUrl: string): Promise<void> {
    const key = fileUrl.replace(`${env.CDN_BASE_URL}/`, '');
    const s3 = getS3Client();
    await s3.send(
      new DeleteObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
      })
    );
  },
};
