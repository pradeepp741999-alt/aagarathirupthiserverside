"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.localStorageDriver = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const env_1 = require("@/config/env");
const MediaUpload_1 = require("@/models/MediaUpload");
const logger_1 = require("@/config/logger");
exports.localStorageDriver = {
    async getUploadUrl(opts) {
        const localToken = crypto_1.default.randomBytes(24).toString('hex');
        const uploadUrl = `${env_1.env.API_BASE_URL}/api/v1/media/local-upload/${localToken}`;
        const fileUrl = `${env_1.env.CDN_BASE_URL}/${opts.key}`;
        await MediaUpload_1.MediaUpload.findOneAndUpdate({ key: opts.key }, {
            ownerRole: opts.ownerRole,
            ownerId: opts.ownerId,
            category: opts.category,
            key: opts.key,
            fileUrl,
            mimeType: opts.mimeType,
            status: 'pending',
            localToken,
            expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 mins
        }, { upsert: true, new: true });
        return { uploadUrl, fileUrl };
    },
    async deleteFile(fileUrl) {
        const relativePath = fileUrl.replace(env_1.env.CDN_BASE_URL, '').replace(/^\//, '');
        const fullPath = path_1.default.resolve(env_1.env.LOCAL_UPLOAD_DIR, relativePath);
        if (fs_1.default.existsSync(fullPath)) {
            try {
                fs_1.default.unlinkSync(fullPath);
            }
            catch (err) {
                logger_1.logger.warn({ err, fullPath }, 'Failed to delete local file');
            }
        }
    },
};
