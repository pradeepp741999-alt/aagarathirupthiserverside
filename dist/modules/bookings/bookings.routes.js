"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bookingsRoutes = void 0;
const express_1 = require("express");
const bookings_controller_1 = require("./bookings.controller");
const authenticate_1 = require("@/common/middleware/authenticate");
const requireRole_1 = require("@/common/middleware/requireRole");
const requireApprovedProvider_1 = require("@/common/middleware/requireApprovedProvider");
const asyncHandler_1 = require("@/common/utils/asyncHandler");
const router = (0, express_1.Router)();
router.use(authenticate_1.authenticate, (0, requireRole_1.requireRole)('provider'), requireApprovedProvider_1.requireApprovedProvider);
// Static routes before /:id
router.get('/counts', (0, asyncHandler_1.asyncHandler)(bookings_controller_1.bookingsController.getCounts));
router.get('/', (0, asyncHandler_1.asyncHandler)(bookings_controller_1.bookingsController.listBookings));
// Parameterized sub-resources
router.patch('/:id/status', (0, asyncHandler_1.asyncHandler)(bookings_controller_1.bookingsController.updateStatus));
router.post('/:id/payments', (0, asyncHandler_1.asyncHandler)(bookings_controller_1.bookingsController.recordPayment));
router.get('/:id/invoice', (0, asyncHandler_1.asyncHandler)(bookings_controller_1.bookingsController.getInvoice));
router.get('/:id', (0, asyncHandler_1.asyncHandler)(bookings_controller_1.bookingsController.getBookingById));
exports.bookingsRoutes = router;
