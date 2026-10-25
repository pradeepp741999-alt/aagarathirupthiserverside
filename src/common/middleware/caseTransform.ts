import { Request, Response, NextFunction } from 'express';
import { deepCamelToSnake, deepSnakeToCamel } from '../utils/caseConvert';

export function caseTransform(req: Request, res: Response, next: NextFunction): void {
  // Apply only for provider role
  if (req.appRole === 'provider') {
    if (req.body && typeof req.body === 'object') {
      req.body = deepSnakeToCamel(req.body);
    }

    if (req.query && typeof req.query === 'object') {
      req.query = deepSnakeToCamel(req.query) as any;
    }

    // Intercept res.json to convert outgoing camelCase payload into snake_case
    const originalJson = res.json.bind(res);
    res.json = function (body: unknown): Response {
      const transformedBody = deepCamelToSnake(body);
      return originalJson(transformedBody);
    };
  }

  next();
}
