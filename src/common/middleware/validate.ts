import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { AppError, FieldErrorDetail } from '../errors/AppError';
import { ERROR_CODES } from '../errors/errorCodes';
import { camelToSnakeString } from '../utils/caseConvert';

export interface ValidationSchemas {
  body?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
  params?: z.ZodTypeAny;
}

export function validate(schemas: ValidationSchemas) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (schemas.params) {
        req.params = (await schemas.params.parseAsync(req.params)) as any;
      }
      if (schemas.query) {
        req.query = (await schemas.query.parseAsync(req.query)) as any;
      }
      if (schemas.body) {
        req.body = await schemas.body.parseAsync(req.body);
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const isProviderOrAdmin = req.appRole === 'provider' || req.appRole === 'admin';
        const statusCode = isProviderOrAdmin ? 422 : 400;

        const details: FieldErrorDetail[] = error.issues.map((err: z.ZodIssue) => {
          const fieldPath = err.path.join('.');
          const field = isProviderOrAdmin ? camelToSnakeString(fieldPath) : fieldPath;
          return {
            field,
            message: err.message,
          };
        });

        const firstMsg = details.length > 0 ? details[0].message : 'Validation failed';
        const fullMessage = isProviderOrAdmin ? 'The given data failed validation.' : `Validation failed: ${firstMsg}`;

        return next(new AppError(statusCode, ERROR_CODES.VALIDATION_ERROR, fullMessage, details));
      }
      next(error);
    }
  };
}
