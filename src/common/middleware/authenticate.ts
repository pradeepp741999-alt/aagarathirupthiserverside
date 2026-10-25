import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '@/config/env';
import { AppError } from '../errors/AppError';
import { ERROR_CODES } from '../errors/errorCodes';
import { AuthContext } from '../types/express';
import { User } from '@/models/User';
import { Provider } from '@/models/Provider';

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(new AppError(401, ERROR_CODES.UNAUTHORIZED, 'Authorization Bearer token required'));
  }

  const token = authHeader.slice(7).trim();
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as AuthContext;
    if (!decoded || !decoded.sub || !decoded.role) {
      return next(new AppError(401, ERROR_CODES.UNAUTHORIZED, 'Invalid token payload'));
    }

    // Role mismatch check if X-App-Role was provided
    if (req.appRole && req.appRole !== decoded.role) {
      return next(new AppError(403, ERROR_CODES.ROLE_MISMATCH, 'X-App-Role header does not match authenticated token role'));
    }

    // Check account status
    if (decoded.role === 'user') {
      const user = await User.findById(decoded.sub).select('status').lean();
      if (!user) {
        return next(new AppError(401, ERROR_CODES.UNAUTHORIZED, 'User account no longer exists'));
      }
      if (user.status === 'blocked') {
        return next(new AppError(403, ERROR_CODES.ACCOUNT_DISABLED, 'Your account has been disabled'));
      }
    } else if (decoded.role === 'provider') {
      const provider = await Provider.findById(decoded.sub).select('status isActive').lean();
      if (!provider) {
        return next(new AppError(401, ERROR_CODES.UNAUTHORIZED, 'Provider account no longer exists'));
      }
      if (provider.status === 'suspended' || provider.isActive === false) {
        return next(new AppError(403, ERROR_CODES.ACCOUNT_DISABLED, 'Provider account has been suspended or disabled'));
      }
    }

    req.auth = decoded;
    req.appRole = decoded.role;
    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return next(new AppError(401, ERROR_CODES.TOKEN_EXPIRED, 'Access token has expired'));
    }
    return next(new AppError(401, ERROR_CODES.UNAUTHORIZED, 'Invalid or corrupted access token'));
  }
}
