"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.meRoutes = void 0;
const express_1 = require("express");
const me_controller_1 = require("./me.controller");
const authenticate_1 = require("@/common/middleware/authenticate");
const requireRole_1 = require("@/common/middleware/requireRole");
const requireApprovedProvider_1 = require("@/common/middleware/requireApprovedProvider");
const asyncHandler_1 = require("@/common/utils/asyncHandler");
const router = (0, express_1.Router)();
router.use(authenticate_1.authenticate, (0, requireRole_1.requireRole)('provider'));
// Available in draft / pending / rejected
router.get('/me/status', (0, asyncHandler_1.asyncHandler)(me_controller_1.meController.getStatus));
router.get('/me', (0, asyncHandler_1.asyncHandler)(me_controller_1.meController.getMe));
// Requires approved provider
router.put('/me', requireApprovedProvider_1.requireApprovedProvider, (0, asyncHandler_1.asyncHandler)(me_controller_1.meController.updateMe));
router.patch('/me/online-status', requireApprovedProvider_1.requireApprovedProvider, (0, asyncHandler_1.asyncHandler)(me_controller_1.meController.patchOnlineStatus));
router.get('/settings', requireApprovedProvider_1.requireApprovedProvider, (0, asyncHandler_1.asyncHandler)(me_controller_1.meController.getSettings));
router.put('/settings', requireApprovedProvider_1.requireApprovedProvider, (0, asyncHandler_1.asyncHandler)(me_controller_1.meController.updateSettings));
exports.meRoutes = router;
