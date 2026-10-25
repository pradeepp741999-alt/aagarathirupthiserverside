import { Request, Response } from 'express';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import { z } from 'zod';
import { storage } from '@/services/storage';
import { MediaUpload, MEDIA_CATEGORIES, MediaCategory } from '@/models/MediaUpload';
import { respond } from '@/common/http/respond';
import { AppError } from '@/common/errors/AppError';
import { ERROR_CODES } from '@/common/errors/errorCodes';
import { env } from '@/config/env';

export const uploadUrlSchema = z.object({
  file_name: z.string().min(1),
  mime_type: z.string().min(1),
  category: z.enum(MEDIA_CATEGORIES),
});

export const mediaController = {
  async getUploadUrl(req: Request, res: Response) {
    if (!req.auth) {
      throw new AppError(401, ERROR_CODES.UNAUTHORIZED, 'Authentication required');
    }

    const { file_name, mime_type, category } = req.body;
    const role = req.auth.role;
    const ownerId = req.auth.sub;

    // Validate category permissions
    const providerOnlyCategories: MediaCategory[] = [
      'provider_documents',
      'dishes',
      'combos',
      'covers',
      'portfolio',
    ];

    if (role === 'user' && providerOnlyCategories.includes(category)) {
      throw new AppError(
        403,
        ERROR_CODES.FORBIDDEN,
        `Role 'user' is not authorized to upload to category: ${category}`
      );
    }

    // Validate MIME types
    const allowedImageMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (category === 'provider_documents') {
      if (!allowedImageMimes.includes(mime_type) && mime_type !== 'application/pdf') {
        throw new AppError(
          422,
          ERROR_CODES.VALIDATION_ERROR,
          'Provider documents must be JPEG, PNG, WEBP, or PDF'
        );
      }
    } else {
      if (!allowedImageMimes.includes(mime_type)) {
        throw new AppError(
          422,
          ERROR_CODES.VALIDATION_ERROR,
          'Images must be JPEG, PNG, or WEBP'
        );
      }
    }

    const ext = path.extname(file_name) || (mime_type === 'application/pdf' ? '.pdf' : '.png');
    const randomUuid = crypto.randomUUID();
    const key = `${category}/${ownerId}/${randomUuid}${ext}`;

    const { uploadUrl, fileUrl } = await storage.getUploadUrl({
      key,
      mimeType: mime_type,
      category,
      ownerId,
      ownerRole: role,
    });

    return respond.ok(req, res, {
      upload_url: uploadUrl,
      file_url: fileUrl,
      expires_in_seconds: 900,
    });
  },

  async handleLocalUpload(req: Request, res: Response) {
    const { token } = req.params;

    if (env.STORAGE_DRIVER !== 'local') {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Local upload driver is not enabled in this environment');
    }

    const upload = await MediaUpload.findOne({ localToken: token });
    if (!upload) {
      throw new AppError(404, ERROR_CODES.NOT_FOUND, 'Invalid or expired upload token');
    }

    const fullFilePath = path.resolve(env.LOCAL_UPLOAD_DIR, upload.key);
    const dir = path.dirname(fullFilePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const writeStream = fs.createWriteStream(fullFilePath);
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
