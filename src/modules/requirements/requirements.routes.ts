import { Router } from 'express';
import { requirementsController } from './requirements.controller';
import { authenticate } from '@/common/middleware/authenticate';
import { requireRole } from '@/common/middleware/requireRole';
import { asyncHandler } from '@/common/utils/asyncHandler';

const router = Router();

router.post(
  '/requirements/draft',
  authenticate,
  requireRole('user'),
  asyncHandler(requirementsController.saveDraft)
);

export const requirementsRoutes = router;
