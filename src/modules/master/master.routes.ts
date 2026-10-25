import { Router } from 'express';
import { masterController } from './master.controller';
import { asyncHandler } from '@/common/utils/asyncHandler';

const router = Router();

router.get('/app/onboarding', asyncHandler(masterController.getOnboardingSlides));
router.get('/categories/details', asyncHandler(masterController.getCategoryDetails));
router.get('/categories', asyncHandler(masterController.getCategories));
router.get('/districts', asyncHandler(masterController.getDistricts));
router.get('/config/event-types', asyncHandler(masterController.getEventTypes));
router.get('/support/faqs', asyncHandler(masterController.getFaqs));
router.get('/providers/filters-meta', asyncHandler(masterController.getFiltersMeta));

export const masterRoutes = router;
