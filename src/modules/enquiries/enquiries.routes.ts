import { Router } from 'express';
import { enquiriesUserController } from './enquiries.user.controller';
import { enquiriesProviderController } from './enquiries.provider.controller';
import { authenticate } from '@/common/middleware/authenticate';
import { byRole } from '@/common/middleware/byRole';
import { requireRole } from '@/common/middleware/requireRole';
import { requireApprovedProvider } from '@/common/middleware/requireApprovedProvider';
import { asyncHandler } from '@/common/utils/asyncHandler';

const router = Router();

router.use(authenticate);

// 1. Static routes first
router.get(
  '/summary',
  requireRole('user'),
  asyncHandler(enquiriesUserController.getSummary)
);

router.get(
  '/counts',
  requireRole('provider'),
  requireApprovedProvider,
  asyncHandler(enquiriesProviderController.getCounts)
);

// 2. Base collection routes
router.post(
  '/',
  requireRole('user'),
  asyncHandler(enquiriesUserController.createEnquiry)
);

router.get(
  '/',
  byRole({
    user: asyncHandler(enquiriesUserController.listEnquiries),
    provider: asyncHandler(enquiriesProviderController.listEnquiries),
  })
);

// 3. Sub-resource routes before generic /:id (or directly under /:id)
router.patch(
  '/:id/status',
  byRole({
    user: asyncHandler(enquiriesUserController.updateStatus),
    provider: asyncHandler(enquiriesProviderController.updateStatus),
  })
);

router.post(
  '/:id/quote',
  requireRole('provider'),
  requireApprovedProvider,
  asyncHandler(enquiriesProviderController.sendQuote)
);

router.post(
  '/:id/messages',
  requireRole('provider'),
  requireApprovedProvider,
  asyncHandler(enquiriesProviderController.appendMessage)
);

// 4. Single item detail route
router.get(
  '/:id',
  byRole({
    user: asyncHandler(enquiriesUserController.getEnquiryById),
    provider: asyncHandler(enquiriesProviderController.getEnquiryById),
  })
);

export const enquiriesRoutes = router;
