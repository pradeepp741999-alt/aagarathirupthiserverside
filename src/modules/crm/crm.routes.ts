import { Router } from 'express';
import { crmController } from './crm.controller';
import { authenticate } from '@/common/middleware/authenticate';
import { requireRole } from '@/common/middleware/requireRole';
import { requireApprovedProvider } from '@/common/middleware/requireApprovedProvider';
import { asyncHandler } from '@/common/utils/asyncHandler';

const router = Router();

router.use(authenticate, requireRole('provider'), requireApprovedProvider);

// Static routes before /customers/:id
router.get('/customers', asyncHandler(crmController.listCustomers));
router.get('/stats', asyncHandler(crmController.getStats));

// Parameterized sub-resources
router.get('/customers/:id/history', asyncHandler(crmController.getCustomerHistory));
router.get('/customers/:id/notes', asyncHandler(crmController.getCustomerNotes));
router.post('/customers/:id/notes', asyncHandler(crmController.addCustomerNote));
router.get('/customers/:id', asyncHandler(crmController.getCustomerById));

export const crmRoutes = router;
