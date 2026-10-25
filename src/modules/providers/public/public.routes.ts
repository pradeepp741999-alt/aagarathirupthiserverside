import { Router } from 'express';
import { publicProvidersController } from './public.controller';
import { availabilityController } from '@/modules/availability/availability.controller';
import { optionalAuth } from '@/common/middleware/optionalAuth';
import { authenticate } from '@/common/middleware/authenticate';
import { requireRole } from '@/common/middleware/requireRole';
import { requireApprovedProvider } from '@/common/middleware/requireApprovedProvider';
import { asyncHandler } from '@/common/utils/asyncHandler';

const router = Router();

// 11. Discovery endpoints (registered before /:id)
router.get('/nearby', optionalAuth, asyncHandler(publicProvidersController.getNearby));
router.post('/match', authenticate, requireRole('user'), asyncHandler(publicProvidersController.match));
router.get('/', optionalAuth, asyncHandler(publicProvidersController.listProviders));

// 12. Public detail endpoints
router.get('/:id', optionalAuth, asyncHandler(publicProvidersController.getProviderDetail));
router.get('/:id/calendar', optionalAuth, asyncHandler(publicProvidersController.getCalendar));

// Provider-mode alias D20: PUT /providers/:id/calendar/date
router.put(
  '/:id/calendar/date',
  authenticate,
  requireRole('provider'),
  requireApprovedProvider,
  asyncHandler(availabilityController.updateDate)
);

router.get('/:id/availability', optionalAuth, asyncHandler(publicProvidersController.getAvailability));
router.get('/:id/reviews', optionalAuth, asyncHandler(publicProvidersController.getReviews));
router.get('/:id/menu', optionalAuth, asyncHandler(publicProvidersController.getMenu));
router.get('/:id/packages', optionalAuth, asyncHandler(publicProvidersController.getPackages));

export const publicProvidersRoutes = router;
