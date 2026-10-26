"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.crmRoutes = void 0;
const express_1 = require("express");
const crm_controller_1 = require("./crm.controller");
const authenticate_1 = require("@/common/middleware/authenticate");
const requireRole_1 = require("@/common/middleware/requireRole");
const requireApprovedProvider_1 = require("@/common/middleware/requireApprovedProvider");
const asyncHandler_1 = require("@/common/utils/asyncHandler");
const router = (0, express_1.Router)();
router.use(authenticate_1.authenticate, (0, requireRole_1.requireRole)('provider'), requireApprovedProvider_1.requireApprovedProvider);
// Static routes before /customers/:id
router.get('/customers', (0, asyncHandler_1.asyncHandler)(crm_controller_1.crmController.listCustomers));
router.get('/stats', (0, asyncHandler_1.asyncHandler)(crm_controller_1.crmController.getStats));
// Parameterized sub-resources
router.get('/customers/:id/history', (0, asyncHandler_1.asyncHandler)(crm_controller_1.crmController.getCustomerHistory));
router.get('/customers/:id/notes', (0, asyncHandler_1.asyncHandler)(crm_controller_1.crmController.getCustomerNotes));
router.post('/customers/:id/notes', (0, asyncHandler_1.asyncHandler)(crm_controller_1.crmController.addCustomerNote));
router.get('/customers/:id', (0, asyncHandler_1.asyncHandler)(crm_controller_1.crmController.getCustomerById));
exports.crmRoutes = router;
