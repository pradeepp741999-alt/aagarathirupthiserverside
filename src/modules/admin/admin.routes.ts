import { Router } from 'express';
import { adminController } from './admin.controller';
import { adminLoginLimiter } from '@/common/middleware/rateLimiters';
import { authenticate } from '@/common/middleware/authenticate';
import { requireRole } from '@/common/middleware/requireRole';
import { asyncHandler } from '@/common/utils/asyncHandler';

const router = Router();

// Public login
router.post('/auth/login', adminLoginLimiter, asyncHandler(adminController.login));

// Protected admin endpoints
router.use(authenticate, requireRole('admin'));

router.get('/providers', asyncHandler(adminController.listProviders));
router.get('/providers/:id', asyncHandler(adminController.getProviderDetail));
router.post('/providers/:id/approve', asyncHandler(adminController.approveProvider));
router.post('/providers/:id/reject', asyncHandler(adminController.rejectProvider));
router.post('/providers/:id/suspend', asyncHandler(adminController.suspendProvider));
router.patch('/providers/:providerId/documents/:type', asyncHandler(adminController.verifyDocument));

router.post('/payouts', asyncHandler(adminController.createPayout));
router.patch('/payouts/:id', asyncHandler(adminController.updatePayout));

router.get('/support/tickets', asyncHandler(adminController.listTickets));
router.patch('/support/tickets/:id', asyncHandler(adminController.updateTicket));

export const adminRoutes = router;
