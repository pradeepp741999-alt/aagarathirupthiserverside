"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRoutes = void 0;
const express_1 = require("express");
const admin_controller_1 = require("./admin.controller");
const rateLimiters_1 = require("@/common/middleware/rateLimiters");
const authenticate_1 = require("@/common/middleware/authenticate");
const requireRole_1 = require("@/common/middleware/requireRole");
const asyncHandler_1 = require("@/common/utils/asyncHandler");
const router = (0, express_1.Router)();
// Public login
router.post('/auth/login', rateLimiters_1.adminLoginLimiter, (0, asyncHandler_1.asyncHandler)(admin_controller_1.adminController.login));
// Protected admin endpoints
router.use(authenticate_1.authenticate, (0, requireRole_1.requireRole)('admin'));
router.get('/providers', (0, asyncHandler_1.asyncHandler)(admin_controller_1.adminController.listProviders));
router.get('/providers/:id', (0, asyncHandler_1.asyncHandler)(admin_controller_1.adminController.getProviderDetail));
router.post('/providers/:id/approve', (0, asyncHandler_1.asyncHandler)(admin_controller_1.adminController.approveProvider));
router.post('/providers/:id/reject', (0, asyncHandler_1.asyncHandler)(admin_controller_1.adminController.rejectProvider));
router.post('/providers/:id/suspend', (0, asyncHandler_1.asyncHandler)(admin_controller_1.adminController.suspendProvider));
router.patch('/providers/:providerId/documents/:type', (0, asyncHandler_1.asyncHandler)(admin_controller_1.adminController.verifyDocument));
router.post('/payouts', (0, asyncHandler_1.asyncHandler)(admin_controller_1.adminController.createPayout));
router.patch('/payouts/:id', (0, asyncHandler_1.asyncHandler)(admin_controller_1.adminController.updatePayout));
router.get('/support/tickets', (0, asyncHandler_1.asyncHandler)(admin_controller_1.adminController.listTickets));
router.patch('/support/tickets/:id', (0, asyncHandler_1.asyncHandler)(admin_controller_1.adminController.updateTicket));
exports.adminRoutes = router;
