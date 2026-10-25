import { Router } from 'express';
import { meController } from './me.controller';
import { authenticate } from '@/common/middleware/authenticate';
import { requireRole } from '@/common/middleware/requireRole';
import { requireApprovedProvider } from '@/common/middleware/requireApprovedProvider';
import { asyncHandler } from '@/common/utils/asyncHandler';

const router = Router();

router.use(authenticate, requireRole('provider'));

// Available in draft / pending / rejected
router.get('/me/status', asyncHandler(meController.getStatus));
router.get('/me', asyncHandler(meController.getMe));

// Requires approved provider
router.put('/me', requireApprovedProvider, asyncHandler(meController.updateMe));
router.patch('/me/online-status', requireApprovedProvider, asyncHandler(meController.patchOnlineStatus));
router.get('/settings', requireApprovedProvider, asyncHandler(meController.getSettings));
router.put('/settings', requireApprovedProvider, asyncHandler(meController.updateSettings));

export const meRoutes = router;
