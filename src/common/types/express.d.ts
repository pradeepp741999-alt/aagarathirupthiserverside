import { AppRole } from '@/config/constants';

export interface AuthContext {
  sub: string;
  role: AppRole;
  sid?: string;
}

declare global {
  namespace Express {
    interface Request {
      appRole?: AppRole;
      auth?: AuthContext;
      id?: string;
    }
  }
}

export {};
