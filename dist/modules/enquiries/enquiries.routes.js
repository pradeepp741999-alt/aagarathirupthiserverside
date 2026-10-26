"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enquiriesRoutes = void 0;
const express_1 = require("express");
const enquiries_user_controller_1 = require("./enquiries.user.controller");
const enquiries_provider_controller_1 = require("./enquiries.provider.controller");
const authenticate_1 = require("@/common/middleware/authenticate");
const byRole_1 = require("@/common/middleware/byRole");
const requireRole_1 = require("@/common/middleware/requireRole");
const requireApprovedProvider_1 = require("@/common/middleware/requireApprovedProvider");
const asyncHandler_1 = require("@/common/utils/asyncHandler");
const router = (0, express_1.Router)();
router.use(authenticate_1.authenticate);
// 1. Static routes first
router.get('/summary', (0, requireRole_1.requireRole)('user'), (0, asyncHandler_1.asyncHandler)(enquiries_user_controller_1.enquiriesUserController.getSummary));
router.get('/counts', (0, requireRole_1.requireRole)('provider'), requireApprovedProvider_1.requireApprovedProvider, (0, asyncHandler_1.asyncHandler)(enquiries_provider_controller_1.enquiriesProviderController.getCounts));
// 2. Base collection routes
router.post('/', (0, requireRole_1.requireRole)('user'), (0, asyncHandler_1.asyncHandler)(enquiries_user_controller_1.enquiriesUserController.createEnquiry));
router.get('/', (0, byRole_1.byRole)({
    user: (0, asyncHandler_1.asyncHandler)(enquiries_user_controller_1.enquiriesUserController.listEnquiries),
    provider: (0, asyncHandler_1.asyncHandler)(enquiries_provider_controller_1.enquiriesProviderController.listEnquiries),
}));
// 3. Sub-resource routes before generic /:id (or directly under /:id)
router.patch('/:id/status', (0, byRole_1.byRole)({
    user: (0, asyncHandler_1.asyncHandler)(enquiries_user_controller_1.enquiriesUserController.updateStatus),
    provider: (0, asyncHandler_1.asyncHandler)(enquiries_provider_controller_1.enquiriesProviderController.updateStatus),
}));
router.post('/:id/quote', (0, requireRole_1.requireRole)('provider'), requireApprovedProvider_1.requireApprovedProvider, (0, asyncHandler_1.asyncHandler)(enquiries_provider_controller_1.enquiriesProviderController.sendQuote));
router.post('/:id/messages', (0, requireRole_1.requireRole)('provider'), requireApprovedProvider_1.requireApprovedProvider, (0, asyncHandler_1.asyncHandler)(enquiries_provider_controller_1.enquiriesProviderController.appendMessage));
// 4. Single item detail route
router.get('/:id', (0, byRole_1.byRole)({
    user: (0, asyncHandler_1.asyncHandler)(enquiries_user_controller_1.enquiriesUserController.getEnquiryById),
    provider: (0, asyncHandler_1.asyncHandler)(enquiries_provider_controller_1.enquiriesProviderController.getEnquiryById),
}));
exports.enquiriesRoutes = router;
