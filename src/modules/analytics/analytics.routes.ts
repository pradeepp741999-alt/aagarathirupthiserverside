import { Router } from 'express';
import { analyticsController } from './analytics.controller';
import { authenticate } from '@/common/middleware/authenticate';
import { requireRole } from '@/common/middleware/requireRole';
import { requireApprovedProvider } from '@/common/middleware/requireApprovedProvider';
import { asyncHandler } from '@/common/utils/asyncHandler';

const router = Router();

router.use(authenticate, requireRole('provider'), requireApprovedProvider);

router.get('/overview', asyncHandler(analyticsController.getOverview));
router.get('/revenue-chart', asyncHandler(analyticsController.getRevenueChart));
router.get('/export', asyncHandler(analyticsController.exportAnalytics));

export const analyticsRoutes = router;
