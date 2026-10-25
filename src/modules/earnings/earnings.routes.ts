import { Router } from 'express';
import { earningsController } from './earnings.controller';
import { authenticate } from '@/common/middleware/authenticate';
import { requireRole } from '@/common/middleware/requireRole';
import { requireApprovedProvider } from '@/common/middleware/requireApprovedProvider';
import { asyncHandler } from '@/common/utils/asyncHandler';

const router = Router();

router.use(authenticate, requireRole('provider'), requireApprovedProvider);

router.get('/earnings/summary', asyncHandler(earningsController.getSummary));
router.get('/earnings/transactions', asyncHandler(earningsController.getTransactions));

export const earningsRoutes = router;
