"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewsProviderRoutes = exports.reviewsUserRoutes = void 0;
const express_1 = require("express");
const reviews_controller_1 = require("./reviews.controller");
const authenticate_1 = require("@/common/middleware/authenticate");
const requireRole_1 = require("@/common/middleware/requireRole");
const requireApprovedProvider_1 = require("@/common/middleware/requireApprovedProvider");
const asyncHandler_1 = require("@/common/utils/asyncHandler");
// User review submission router (POST /api/v1/reviews)
const userRouter = (0, express_1.Router)();
userRouter.post('/', authenticate_1.authenticate, (0, requireRole_1.requireRole)('user'), (0, asyncHandler_1.asyncHandler)(reviews_controller_1.reviewsController.submitReview));
// Provider review router (mounted under /api/v1/providers)
const providerRouter = (0, express_1.Router)();
providerRouter.use(authenticate_1.authenticate, (0, requireRole_1.requireRole)('provider'), requireApprovedProvider_1.requireApprovedProvider);
providerRouter.get('/reviews/summary', (0, asyncHandler_1.asyncHandler)(reviews_controller_1.reviewsController.getProviderReviewsSummary));
providerRouter.get('/reviews', (0, asyncHandler_1.asyncHandler)(reviews_controller_1.reviewsController.getProviderReviews));
providerRouter.post('/reviews/:id/reply', (0, asyncHandler_1.asyncHandler)(reviews_controller_1.reviewsController.replyToReview));
exports.reviewsUserRoutes = userRouter;
exports.reviewsProviderRoutes = providerRouter;
