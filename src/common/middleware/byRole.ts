import { Request, Response, NextFunction, RequestHandler } from 'express';
import { AppRole } from '@/config/constants';
import { AppError } from '../errors/AppError';
import { ERROR_CODES } from '../errors/errorCodes';

export interface RoleHandlers {
  user?: RequestHandler;
  provider?: RequestHandler;
  admin?: RequestHandler;
}

export function byRole(handlers: RoleHandlers): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const role: AppRole | undefined = req.auth?.role || req.appRole;

    if (!role) {
      return next(new AppError(400, ERROR_CODES.ROLE_REQUIRED, 'Unable to determine app role'));
    }

    const handler = handlers[role];
    if (!handler) {
      return next(
        new AppError(
          403,
          ERROR_CODES.ROLE_MISMATCH,
          `This action is not supported for role: ${role}`
        )
      );
    }

    return handler(req, res, next);
  };
}
