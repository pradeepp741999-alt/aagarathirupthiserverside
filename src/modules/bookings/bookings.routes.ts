import { Router } from 'express';
import { bookingsController } from './bookings.controller';
import { authenticate } from '@/common/middleware/authenticate';
import { requireRole } from '@/common/middleware/requireRole';
import { requireApprovedProvider } from '@/common/middleware/requireApprovedProvider';
import { asyncHandler } from '@/common/utils/asyncHandler';

const router = Router();

router.use(authenticate, requireRole('provider'), requireApprovedProvider);

// Static routes before /:id
router.get('/counts', asyncHandler(bookingsController.getCounts));
router.get('/', asyncHandler(bookingsController.listBookings));

// Parameterized sub-resources
router.patch('/:id/status', asyncHandler(bookingsController.updateStatus));
router.post('/:id/payments', asyncHandler(bookingsController.recordPayment));
router.get('/:id/invoice', asyncHandler(bookingsController.getInvoice));
router.get('/:id', asyncHandler(bookingsController.getBookingById));

export const bookingsRoutes = router;
