import { Router } from 'express';
import { notificationsController } from './notifications.controller';
import { authenticate } from '@/common/middleware/authenticate';
import { asyncHandler } from '@/common/utils/asyncHandler';

const router = Router();

router.use(authenticate);

// 1. Static endpoints
router.get('/unread-count', asyncHandler(notificationsController.getUnreadCount));
router.patch('/mark-all-read', asyncHandler(notificationsController.markAllRead));

// 2. Base list
router.get('/', asyncHandler(notificationsController.listNotifications));

// 3. Parameterized sub-resources
router.patch('/:id/read', asyncHandler(notificationsController.markRead));
router.delete('/:id', asyncHandler(notificationsController.deleteNotification));

export const notificationsRoutes = router;
