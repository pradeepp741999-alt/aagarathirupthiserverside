import { Router } from 'express';
import { packagesController } from './packages.controller';
import { authenticate } from '@/common/middleware/authenticate';
import { requireRole } from '@/common/middleware/requireRole';
import { requireApprovedProvider } from '@/common/middleware/requireApprovedProvider';
import { asyncHandler } from '@/common/utils/asyncHandler';

const router = Router();

router.use(authenticate, requireRole('provider'), requireApprovedProvider);

router.get('/packages', asyncHandler(packagesController.getPackages));
router.post('/packages', asyncHandler(packagesController.createPackage));
router.get('/packages/:id', asyncHandler(packagesController.getPackageById));
router.put('/packages/:id', asyncHandler(packagesController.updatePackage));
router.patch('/packages/:id/status', asyncHandler(packagesController.patchPackageStatus));
router.delete('/packages/:id', asyncHandler(packagesController.deletePackage));

export const packagesRoutes = router;
