import { Router } from 'express';
import { combosController } from './combos.controller';
import { authenticate } from '@/common/middleware/authenticate';
import { requireRole } from '@/common/middleware/requireRole';
import { requireApprovedProvider } from '@/common/middleware/requireApprovedProvider';
import { asyncHandler } from '@/common/utils/asyncHandler';

const providerRouter = Router();
providerRouter.use(authenticate, requireRole('provider'), requireApprovedProvider);

providerRouter.get('/combos', asyncHandler(combosController.getProviderCombos));
providerRouter.post('/combos', asyncHandler(combosController.createCombo));
providerRouter.get('/combos/:id', asyncHandler(combosController.getComboById));
providerRouter.put('/combos/:id', asyncHandler(combosController.updateCombo));
providerRouter.patch('/combos/:id/status', asyncHandler(combosController.patchComboStatus));
providerRouter.delete('/combos/:id', asyncHandler(combosController.deleteCombo));

// Public & user alias router
const publicRouter = Router();
publicRouter.get('/combos/special', asyncHandler(combosController.getPublicSpecialCombos));
publicRouter.post(
  '/combos/special',
  authenticate,
  requireRole('provider'),
  requireApprovedProvider,
  asyncHandler(combosController.createCombo)
);

export const combosRoutes = providerRouter;
export const combosPublicRoutes = publicRouter;
