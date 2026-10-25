import { Router } from 'express';
import { reviewsController } from './reviews.controller';
import { authenticate } from '@/common/middleware/authenticate';
import { requireRole } from '@/common/middleware/requireRole';
import { requireApprovedProvider } from '@/common/middleware/requireApprovedProvider';
import { asyncHandler } from '@/common/utils/asyncHandler';

// User review submission router (POST /api/v1/reviews)
const userRouter = Router();
userRouter.post(
  '/',
  authenticate,
  requireRole('user'),
  asyncHandler(reviewsController.submitReview)
);

// Provider review router (mounted under /api/v1/providers)
const providerRouter = Router();
providerRouter.use(authenticate, requireRole('provider'), requireApprovedProvider);
providerRouter.get('/reviews/summary', asyncHandler(reviewsController.getProviderReviewsSummary));
providerRouter.get('/reviews', asyncHandler(reviewsController.getProviderReviews));
providerRouter.post('/reviews/:id/reply', asyncHandler(reviewsController.replyToReview));

export const reviewsUserRoutes = userRouter;
export const reviewsProviderRoutes = providerRouter;
