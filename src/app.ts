import express, { Express, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import mongoSanitize from 'express-mongo-sanitize';
import path from 'path';
import crypto from 'crypto';
import { env } from '@/config/env';
import { globalLimiter } from '@/common/middleware/rateLimiters';
import { roleContext } from '@/common/middleware/roleContext';
import { caseTransform } from '@/common/middleware/caseTransform';
import { errorHandler } from '@/common/middleware/errorHandler';
import { notFound } from '@/common/middleware/notFound';
import apiRouter from '@/routes/index';

const app: Express = express();

// Trust proxy
if (env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

// Disable x-powered-by header
app.disable('x-powered-by');

// Security headers
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// CORS configuration for Web and Mobile clients
const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    // Mobile apps and CLI/Postman do not send an Origin header; always allowed
    if (!origin) {
      return callback(null, true);
    }

    const cleanOrigin = origin.replace(/\/+$/, '').toLowerCase();
    const allowedOrigins = env.CORS_ORIGINS.map((o) => o.replace(/\/+$/, '').toLowerCase());

    if (
      allowedOrigins.includes('*') ||
      allowedOrigins.includes(cleanOrigin) ||
      cleanOrigin === 'https://test-three-mu-12.vercel.app' ||
      cleanOrigin === 'https://aagarathirupthiprovider.vercel.app' ||
      cleanOrigin.endsWith('.vercel.app')
    ) {
      return callback(null, true);
    }

    callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-App-Role',
    'X-App-Version',
    'X-Request-Id',
  ],
  exposedHeaders: ['X-Request-Id'],
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Request ID header middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const reqId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  req.id = reqId;
  res.setHeader('X-Request-Id', reqId);
  next();
});

// Static file serving for local uploads driver
const uploadsDir = path.resolve(process.cwd(), 'uploads');
app.use('/static/uploads', express.static(uploadsDir));

// Body parsing with 1MB limit
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Sanitize MongoDB operators to prevent injection
app.use(mongoSanitize());

// Global Rate Limiter (skip in testing environment)
if (env.NODE_ENV !== 'test') {
  app.use(globalLimiter);
}

// Role Context Resolution (X-App-Role / JWT)
app.use(roleContext);

// Dynamic Case Transformation for Provider Role
app.use(caseTransform);

// Central API Router
app.use('/api/v1', apiRouter);

// 404 Catch-all
app.use(notFound);

// Central Error Handler
app.use(errorHandler);

export { app };
