import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '@/config/env';
import { AppError } from '../errors/AppError';
import { ERROR_CODES } from '../errors/errorCodes';
import { AppRole, APP_ROLES } from '@/config/constants';

interface DecodedToken {
  sub: string;
  role: AppRole;
  sid?: string;
}

export function roleContext(req: Request, res: Response, next: NextFunction): void {
  // Allow browser CORS preflight requests without requiring X-App-Role
  if (req.method === 'OPTIONS') {
    return next();
  }

  const headerRole = req.headers['x-app-role'] as string | undefined;
  const authHeader = req.headers.authorization;

  let verifiedTokenRole: AppRole | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as DecodedToken;
      if (decoded && decoded.role) {
        verifiedTokenRole = decoded.role;
      }
    } catch {
      // Ignored here; authentication middleware will reject if route requires auth
    }
  }

  let resolvedRole: AppRole | undefined;

  // 1. Header role validation
  let normalizedHeaderRole: AppRole | undefined;
  if (headerRole && (APP_ROLES as readonly string[]).includes(headerRole.toLowerCase())) {
    normalizedHeaderRole = headerRole.toLowerCase() as AppRole;
  }

  // 2. Token role check & mismatch enforcement
  if (verifiedTokenRole) {
    if (normalizedHeaderRole && normalizedHeaderRole !== verifiedTokenRole) {
      throw new AppError(403, ERROR_CODES.ROLE_MISMATCH, 'X-App-Role does not match authenticated token role');
    }
    resolvedRole = verifiedTokenRole;
  } else if (normalizedHeaderRole) {
    resolvedRole = normalizedHeaderRole;
  }

  // 3. Fallback logic
  if (!resolvedRole) {
    const isAuthRoute = req.path.includes('/auth') && !req.path.includes('/admin');
    if (isAuthRoute) {
      throw new AppError(400, ERROR_CODES.ROLE_REQUIRED, 'X-App-Role header (user|provider) is required for auth endpoints');
    }
    // Admin routes default to admin if under /admin
    if (req.path.includes('/admin')) {
      resolvedRole = 'admin';
    } else {
      resolvedRole = 'user';
    }
  }

  req.appRole = resolvedRole;
  next();
}
