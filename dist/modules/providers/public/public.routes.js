"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publicProvidersRoutes = void 0;
const express_1 = require("express");
const public_controller_1 = require("./public.controller");
const availability_controller_1 = require("@/modules/availability/availability.controller");
const optionalAuth_1 = require("@/common/middleware/optionalAuth");
const authenticate_1 = require("@/common/middleware/authenticate");
const requireRole_1 = require("@/common/middleware/requireRole");
const requireApprovedProvider_1 = require("@/common/middleware/requireApprovedProvider");
const asyncHandler_1 = require("@/common/utils/asyncHandler");
const router = (0, express_1.Router)();
// 11. Discovery endpoints (registered before /:id)
router.get('/nearby', optionalAuth_1.optionalAuth, (0, asyncHandler_1.asyncHandler)(public_controller_1.publicProvidersController.getNearby));
router.post('/match', authenticate_1.authenticate, (0, requireRole_1.requireRole)('user'), (0, asyncHandler_1.asyncHandler)(public_controller_1.publicProvidersController.match));
router.get('/', optionalAuth_1.optionalAuth, (0, asyncHandler_1.asyncHandler)(public_controller_1.publicProvidersController.listProviders));
// 12. Public detail endpoints
router.get('/:id', optionalAuth_1.optionalAuth, (0, asyncHandler_1.asyncHandler)(public_controller_1.publicProvidersController.getProviderDetail));
router.get('/:id/calendar', optionalAuth_1.optionalAuth, (0, asyncHandler_1.asyncHandler)(public_controller_1.publicProvidersController.getCalendar));
// Provider-mode alias D20: PUT /providers/:id/calendar/date
router.put('/:id/calendar/date', authenticate_1.authenticate, (0, requireRole_1.requireRole)('provider'), requireApprovedProvider_1.requireApprovedProvider, (0, asyncHandler_1.asyncHandler)(availability_controller_1.availabilityController.updateDate));
router.get('/:id/availability', optionalAuth_1.optionalAuth, (0, asyncHandler_1.asyncHandler)(public_controller_1.publicProvidersController.getAvailability));
router.get('/:id/reviews', optionalAuth_1.optionalAuth, (0, asyncHandler_1.asyncHandler)(public_controller_1.publicProvidersController.getReviews));
router.get('/:id/menu', optionalAuth_1.optionalAuth, (0, asyncHandler_1.asyncHandler)(public_controller_1.publicProvidersController.getMenu));
router.get('/:id/packages', optionalAuth_1.optionalAuth, (0, asyncHandler_1.asyncHandler)(public_controller_1.publicProvidersController.getPackages));
exports.publicProvidersRoutes = router;
