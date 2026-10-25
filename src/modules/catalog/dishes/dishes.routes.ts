import { Router } from 'express';
import { dishesController } from './dishes.controller';
import { authenticate } from '@/common/middleware/authenticate';
import { requireRole } from '@/common/middleware/requireRole';
import { requireApprovedProvider } from '@/common/middleware/requireApprovedProvider';
import { asyncHandler } from '@/common/utils/asyncHandler';

const router = Router();

router.use(authenticate, requireRole('provider'), requireApprovedProvider);

router.get('/dishes', asyncHandler(dishesController.getDishes));
router.post('/dishes', asyncHandler(dishesController.createDish));
router.get('/dishes/:id', asyncHandler(dishesController.getDishById));
router.put('/dishes/:id', asyncHandler(dishesController.updateDish));
router.patch('/dishes/:id/status', asyncHandler(dishesController.patchDishStatus));
router.delete('/dishes/:id', asyncHandler(dishesController.deleteDish));

export const dishesRoutes = router;
