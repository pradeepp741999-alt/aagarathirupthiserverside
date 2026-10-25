import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError';
import { ERROR_CODES } from '../errors/errorCodes';
import { logger } from '@/config/logger';

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): Response {
  const isProviderOrAdmin = req.appRole === 'provider' || req.appRole === 'admin';
  const requestId = req.id || (req.headers['x-request-id'] as string);

  let statusCode = 500;
  let code: string = ERROR_CODES.INTERNAL_ERROR;
  let message = 'An unexpected internal error occurred';
  let details: unknown = undefined;

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    code = err.code;
    message = err.message;
    details = err.details;
  } else if ((err as any).code === 11000) {
    statusCode = 409;
    code = ERROR_CODES.ALREADY_EXISTS;
    message = 'A record with this identifier already exists';
  } else if (err instanceof SyntaxError && 'body' in err) {
    statusCode = 400;
    code = ERROR_CODES.VALIDATION_ERROR;
    message = 'Malformed JSON request body';
  } else {
    logger.error({ err, path: req.path, method: req.method }, 'Unhandled server error');
  }

  if (isProviderOrAdmin) {
    const errorPayload: Record<string, unknown> = {
      code,
      message,
    };
    if (details) {
      errorPayload.details = details;
    }
    if (requestId) {
      errorPayload.requestId = requestId;
    }

    return res.status(statusCode).json({
      success: false,
      error: errorPayload,
    });
  }

  // User error format
  const userPayload: Record<string, unknown> = {
    success: false,
    statusCode,
    code,
    message,
  };
  if (details) {
    userPayload.errors = details;
  }
  if (requestId) {
    userPayload.requestId = requestId;
  }

  return res.status(statusCode).json(userPayload);
}
