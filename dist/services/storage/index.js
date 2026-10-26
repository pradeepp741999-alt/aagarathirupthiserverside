"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storage = void 0;
const env_1 = require("@/config/env");
const MediaUpload_1 = require("@/models/MediaUpload");
const AppError_1 = require("@/common/errors/AppError");
const errorCodes_1 = require("@/common/errors/errorCodes");
const local_1 = require("./local");
const s3_1 = require("./s3");
exports.storage = {
    async getUploadUrl(opts) {
        if (env_1.env.STORAGE_DRIVER === 's3') {
            return s3_1.s3StorageDriver.getUploadUrl(opts);
        }
        return local_1.localStorageDriver.getUploadUrl(opts);
    },
    async deleteFile(fileUrl) {
        if (env_1.env.STORAGE_DRIVER === 's3') {
            return s3_1.s3StorageDriver.deleteFile(fileUrl);
        }
        return local_1.localStorageDriver.deleteFile(fileUrl);
    },
    async assertOwned(fileUrl, owner) {
        // If dev external images allowed and starts with http(s) not on our CDN
        if (env_1.env.ALLOW_EXTERNAL_IMAGE_URLS && !fileUrl.startsWith(env_1.env.CDN_BASE_URL)) {
            return;
        }
        if (!fileUrl.startsWith(env_1.env.CDN_BASE_URL)) {
            throw new AppError_1.AppError(422, errorCodes_1.ERROR_CODES.INVALID_FILE_URL, `File URL must start with ${env_1.env.CDN_BASE_URL}`);
        }
        const upload = await MediaUpload_1.MediaUpload.findOne({
            fileUrl,
            ownerRole: owner.ownerRole,
            ownerId: owner.ownerId,
        });
        if (!upload) {
            throw new AppError_1.AppError(422, errorCodes_1.ERROR_CODES.INVALID_FILE_URL, 'File URL was not registered or belongs to a different account');
        }
        // Mark status uploaded
        if (upload.status === 'pending') {
            upload.status = 'uploaded';
            await upload.save();
        }
    },
};
