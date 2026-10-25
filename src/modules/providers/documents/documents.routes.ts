import { Router } from 'express';
import { documentsController } from './documents.controller';
import { authenticate } from '@/common/middleware/authenticate';
import { requireRole } from '@/common/middleware/requireRole';
import { asyncHandler } from '@/common/utils/asyncHandler';

const router = Router();

router.use(authenticate, requireRole('provider'));

router.get('/documents', asyncHandler(documentsController.getDocuments));
router.put('/documents/:type', asyncHandler(documentsController.updateDocument));

export const documentsRoutes = router;
