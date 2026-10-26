"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mediaController = exports.uploadUrlSchema = void 0;
const crypto_1 = __importDefault(require("crypto"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const zod_1 = require("zod");
const storage_1 = require("@/services/storage");
const MediaUpload_1 = require("@/models/MediaUpload");
const respond_1 = require("@/common/http/respond");
const AppError_1 = require("@/common/errors/AppError");
const errorCodes_1 = require("@/common/errors/errorCodes");
const env_1 = require("@/config/env");
exports.uploadUrlSchema = zod_1.z.object({
    file_name: zod_1.z.string().min(1),
    mime_type: zod_1.z.string().min(1),
    category: zod_1.z.enum(MediaUpload_1.MEDIA_CATEGORIES),
});
exports.mediaController = {
    async getUploadUrl(req, res) {
        if (!req.auth) {
            throw new AppError_1.AppError(401, errorCodes_1.ERROR_CODES.UNAUTHORIZED, 'Authentication required');
        }
        const { file_name, mime_type, category } = req.body;
        const role = req.auth.role;
        const ownerId = req.auth.sub;
        // Validate category permissions
        const providerOnlyCategories = [
            'provider_documents',
            'dishes',
            'combos',
            'covers',
            'portfolio',
        ];
        if (role === 'user' && providerOnlyCategories.includes(category)) {
            throw new AppError_1.AppError(403, errorCodes_1.ERROR_CODES.FORBIDDEN, `Role 'user' is not authorized to upload to category: ${category}`);
        }
        // Validate MIME types
        const allowedImageMimes = ['image/jpeg', 'image/png', 'image/webp'];
        if (category === 'provider_documents') {
            if (!allowedImageMimes.includes(mime_type) && mime_type !== 'application/pdf') {
                throw new AppError_1.AppError(422, errorCodes_1.ERROR_CODES.VALIDATION_ERROR, 'Provider documents must be JPEG, PNG, WEBP, or PDF');
            }
        }
        else {
            if (!allowedImageMimes.includes(mime_type)) {
                throw new AppError_1.AppError(422, errorCodes_1.ERROR_CODES.VALIDATION_ERROR, 'Images must be JPEG, PNG, or WEBP');
            }
        }
        const ext = path_1.default.extname(file_name) || (mime_type === 'application/pdf' ? '.pdf' : '.png');
        const randomUuid = crypto_1.default.randomUUID();
        const key = `${category}/${ownerId}/${randomUuid}${ext}`;
        const { uploadUrl, fileUrl } = await storage_1.storage.getUploadUrl({
            key,
            mimeType: mime_type,
            category,
            ownerId,
            ownerRole: role,
        });
        return respond_1.respond.ok(req, res, {
            upload_url: uploadUrl,
            file_url: fileUrl,
            expires_in_seconds: 900,
        });
    },
    async handleLocalUpload(req, res) {
        const { token } = req.params;
        if (env_1.env.STORAGE_DRIVER !== 'local') {
            throw new AppError_1.AppError(404, errorCodes_1.ERROR_CODES.NOT_FOUND, 'Local upload driver is not enabled in this environment');
        }
        const upload = await MediaUpload_1.MediaUpload.findOne({ localToken: token });
        if (!upload) {
            throw new AppError_1.AppError(404, errorCodes_1.ERROR_CODES.NOT_FOUND, 'Invalid or expired upload token');
        }
        const fullFilePath = path_1.default.resolve(env_1.env.LOCAL_UPLOAD_DIR, upload.key);
        const dir = path_1.default.dirname(fullFilePath);
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
        const writeStream = fs_1.default.createWriteStream(fullFilePath);
        req.pipe(writeStream);
        writeStream.on('finish', async () => {
            upload.status = 'uploaded';
            await upload.save();
            return res.status(200).json({ success: true, message: 'File uploaded successfully' });
        });
        writeStream.on('error', (err) => {
            return res.status(500).json({ success: false, message: 'Failed to write file buffer: ' + err.message });
        });
    },
};
