"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationsRoutes = void 0;
const express_1 = require("express");
const notifications_controller_1 = require("./notifications.controller");
const authenticate_1 = require("@/common/middleware/authenticate");
const asyncHandler_1 = require("@/common/utils/asyncHandler");
const router = (0, express_1.Router)();
router.use(authenticate_1.authenticate);
// 1. Static endpoints
router.get('/unread-count', (0, asyncHandler_1.asyncHandler)(notifications_controller_1.notificationsController.getUnreadCount));
router.patch('/mark-all-read', (0, asyncHandler_1.asyncHandler)(notifications_controller_1.notificationsController.markAllRead));
// 2. Base list
router.get('/', (0, asyncHandler_1.asyncHandler)(notifications_controller_1.notificationsController.listNotifications));
// 3. Parameterized sub-resources
router.patch('/:id/read', (0, asyncHandler_1.asyncHandler)(notifications_controller_1.notificationsController.markRead));
router.delete('/:id', (0, asyncHandler_1.asyncHandler)(notifications_controller_1.notificationsController.deleteNotification));
exports.notificationsRoutes = router;
