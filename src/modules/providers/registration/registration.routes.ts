import { Router } from 'express';
import { registrationController } from './registration.controller';
import { authenticate } from '@/common/middleware/authenticate';
import { requireRole } from '@/common/middleware/requireRole';
import { asyncHandler } from '@/common/utils/asyncHandler';

const router = Router();

router.use(authenticate, requireRole('provider'));

router.get('/registration/draft', asyncHandler(registrationController.getDraft));
router.put('/registration/step/:n', asyncHandler(registrationController.saveStep));
router.get('/registration/summary', asyncHandler(registrationController.getSummary));
router.post('/registration/submit', asyncHandler(registrationController.submit));

export const registrationRoutes = router;
