import { Router } from 'express';
import { mediaController, uploadUrlSchema } from './media.controller';
import { authenticate } from '@/common/middleware/authenticate';
import { validate } from '@/common/middleware/validate';
import { asyncHandler } from '@/common/utils/asyncHandler';

const router = Router();

router.post(
  '/media/upload-url',
  authenticate,
  validate({ body: uploadUrlSchema }),
  asyncHandler(mediaController.getUploadUrl)
);

// Dev local upload target
router.put('/media/local-upload/:token', mediaController.handleLocalUpload);

export const mediaRoutes = router;
