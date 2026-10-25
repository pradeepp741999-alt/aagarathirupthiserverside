import { Router } from 'express';
import { supportController } from './support.controller';
import { optionalAuth } from '@/common/middleware/optionalAuth';
import { masterController } from '@/modules/master/master.controller';
import { asyncHandler } from '@/common/utils/asyncHandler';

const router = Router();

router.get('/faqs', asyncHandler(masterController.getFaqs));
router.post('/enquiry', optionalAuth, asyncHandler(supportController.createSupportEnquiry));
router.post('/tickets', optionalAuth, asyncHandler(supportController.createTicket));

export const supportRoutes = router;
