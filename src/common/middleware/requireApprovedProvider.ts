import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { ERROR_CODES } from '../errors/errorCodes';
import { Provider } from '@/models/Provider';

export async function requireApprovedProvider(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.auth) {
    return next(new AppError(401, ERROR_CODES.UNAUTHORIZED, 'Authentication required'));
  }

  if (req.auth.role !== 'provider') {
    return next(new AppError(403, ERROR_CODES.FORBIDDEN, 'Endpoint restricted to providers'));
  }

  const provider = await Provider.findById(req.auth.sub).select('status isActive').lean();
  if (!provider) {
    return next(new AppError(404, ERROR_CODES.NOT_FOUND, 'Provider account not found'));
  }

  if (provider.status === 'suspended' || provider.isActive === false) {
    return next(new AppError(403, ERROR_CODES.ACCOUNT_DISABLED, 'Provider account is disabled or suspended'));
  }

  if (provider.status !== 'approved') {
    return next(
      new AppError(
        403,
        ERROR_CODES.PROVIDER_NOT_APPROVED,
        'Provider account has not been approved yet. Action requires an approved account.'
      )
    );
  }

  next();
}
