import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '@/config/env';
import { AuthContext } from '../types/express';
import { User } from '@/models/User';
import { Provider } from '@/models/Provider';

export async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.slice(7).trim();
  try {
    const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as AuthContext;
    if (decoded && decoded.sub && decoded.role) {
      if (decoded.role === 'user') {
        const user = await User.findById(decoded.sub).select('status').lean();
        if (user && user.status !== 'blocked') {
          req.auth = decoded;
          req.appRole = decoded.role;
        }
      } else if (decoded.role === 'provider') {
        const provider = await Provider.findById(decoded.sub).select('status isActive').lean();
        if (provider && provider.status !== 'suspended' && provider.isActive !== false) {
          req.auth = decoded;
          req.appRole = decoded.role;
        }
      } else if (decoded.role === 'admin') {
        req.auth = decoded;
        req.appRole = decoded.role;
      }
    }
  } catch {
    // Gracefully ignore token errors on optional auth
  }

  next();
}
