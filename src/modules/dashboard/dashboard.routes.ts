import { Router } from 'express';
import { dashboardController } from './dashboard.controller';
import { authenticate } from '@/common/middleware/authenticate';
import { requireRole } from '@/common/middleware/requireRole';
import { requireApprovedProvider } from '@/common/middleware/requireApprovedProvider';
import { asyncHandler } from '@/common/utils/asyncHandler';

const router = Router();

router.use(authenticate, requireRole('provider'), requireApprovedProvider);

router.get('/metrics', asyncHandler(dashboardController.getMetrics));

export const dashboardRoutes = router;
