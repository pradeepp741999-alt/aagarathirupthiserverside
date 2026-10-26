"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.s3StorageDriver = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const env_1 = require("@/config/env");
const MediaUpload_1 = require("@/models/MediaUpload");
let s3ClientInstance = null;
function getS3Client() {
    if (!s3ClientInstance) {
        s3ClientInstance = new client_s3_1.S3Client({
            region: env_1.env.S3_REGION || 'ap-south-1',
            endpoint: env_1.env.S3_ENDPOINT || undefined,
            credentials: env_1.env.S3_ACCESS_KEY_ID && env_1.env.S3_SECRET_ACCESS_KEY
                ? {
                    accessKeyId: env_1.env.S3_ACCESS_KEY_ID,
                    secretAccessKey: env_1.env.S3_SECRET_ACCESS_KEY,
                }
                : undefined,
        });
    }
    return s3ClientInstance;
}
exports.s3StorageDriver = {
    async getUploadUrl(opts) {
        const s3 = getS3Client();
        const command = new client_s3_1.PutObjectCommand({
            Bucket: env_1.env.S3_BUCKET,
            Key: opts.key,
            ContentType: opts.mimeType,
        });
        const uploadUrl = await (0, s3_request_presigner_1.getSignedUrl)(s3, command, { expiresIn: 900 });
        const fileUrl = `${env_1.env.CDN_BASE_URL}/${opts.key}`;
        await MediaUpload_1.MediaUpload.findOneAndUpdate({ key: opts.key }, {
            ownerRole: opts.ownerRole,
            ownerId: opts.ownerId,
            category: opts.category,
            key: opts.key,
            fileUrl,
            mimeType: opts.mimeType,
            status: 'pending',
            expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        }, { upsert: true, new: true });
        return { uploadUrl, fileUrl };
    },
    async deleteFile(fileUrl) {
        const key = fileUrl.replace(`${env_1.env.CDN_BASE_URL}/`, '');
        const s3 = getS3Client();
        await s3.send(new client_s3_1.DeleteObjectCommand({
            Bucket: env_1.env.S3_BUCKET,
            Key: key,
        }));
    },
};
