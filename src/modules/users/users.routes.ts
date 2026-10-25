import { Router } from 'express';
import { usersController } from './users.controller';
import {
  userProfileCreateSchema,
  userProfileUpdateSchema,
  userLocationPatchSchema,
} from './users.validation';
import { authenticate } from '@/common/middleware/authenticate';
import { requireRole } from '@/common/middleware/requireRole';
import { validate } from '@/common/middleware/validate';
import { asyncHandler } from '@/common/utils/asyncHandler';

const router = Router();

router.post(
  '/user/profile',
  authenticate,
  requireRole('user'),
  validate({ body: userProfileCreateSchema }),
  asyncHandler(usersController.createProfile)
);

router.get(
  '/user/profile',
  authenticate,
  requireRole('user'),
  asyncHandler(usersController.getProfile)
);

router.put(
  '/user/profile',
  authenticate,
  requireRole('user'),
  validate({ body: userProfileUpdateSchema }),
  asyncHandler(usersController.updateProfile)
);

router.patch(
  '/user/location',
  authenticate,
  requireRole('user'),
  validate({ body: userLocationPatchSchema }),
  asyncHandler(usersController.patchLocation)
);

export const usersRoutes = router;
