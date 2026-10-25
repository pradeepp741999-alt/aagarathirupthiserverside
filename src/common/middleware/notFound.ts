import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { ERROR_CODES } from '../errors/errorCodes';

export function notFound(req: Request, res: Response, next: NextFunction): void {
  next(new AppError(404, ERROR_CODES.NOT_FOUND, `Route not found: ${req.method} ${req.originalUrl}`));
}
