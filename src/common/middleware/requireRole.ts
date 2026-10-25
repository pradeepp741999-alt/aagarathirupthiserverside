import { Request, Response, NextFunction } from 'express';
import { AppRole } from '@/config/constants';
import { AppError } from '../errors/AppError';
import { ERROR_CODES } from '../errors/errorCodes';

export function requireRole(allowedRole: AppRole | AppRole[]) {
  const roles = Array.isArray(allowedRole) ? allowedRole : [allowedRole];

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      return next(new AppError(401, ERROR_CODES.UNAUTHORIZED, 'Authentication required'));
    }

    if (!roles.includes(req.auth.role)) {
      return next(new AppError(403, ERROR_CODES.FORBIDDEN, `Access forbidden for role: ${req.auth.role}`));
    }

    next();
  };
}
