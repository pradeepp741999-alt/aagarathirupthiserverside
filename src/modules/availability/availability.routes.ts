import { Router } from 'express';
import { availabilityController } from './availability.controller';
import { authenticate } from '@/common/middleware/authenticate';
import { requireRole } from '@/common/middleware/requireRole';
import { requireApprovedProvider } from '@/common/middleware/requireApprovedProvider';
import { asyncHandler } from '@/common/utils/asyncHandler';

const router = Router();

router.use(authenticate, requireRole('provider'), requireApprovedProvider);

router.get('/availability/month', asyncHandler(availabilityController.getMonth));
router.put('/availability/date', asyncHandler(availabilityController.updateDate));
router.post('/availability/bulk', asyncHandler(availabilityController.bulkUpdate));

export const availabilityRoutes = router;
