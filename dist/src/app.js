"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const cors_1 = __importDefault(require("cors"));
const express_mongo_sanitize_1 = __importDefault(require("express-mongo-sanitize"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const env_1 = require("@/config/env");
const rateLimiters_1 = require("@/common/middleware/rateLimiters");
const roleContext_1 = require("@/common/middleware/roleContext");
const caseTransform_1 = require("@/common/middleware/caseTransform");
const errorHandler_1 = require("@/common/middleware/errorHandler");
const notFound_1 = require("@/common/middleware/notFound");
const index_1 = __importDefault(require("@/routes/index"));
const app = (0, express_1.default)();
exports.app = app;
// Trust proxy
if (env_1.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}
// Disable x-powered-by header
app.disable('x-powered-by');
// Security headers
app.use((0, helmet_1.default)({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
// CORS configuration for Web and Mobile clients
const corsOptions = {
    origin: (origin, callback) => {
        // Mobile apps and CLI/Postman do not send an Origin header; always allowed
        if (!origin) {
            return callback(null, true);
        }
        const cleanOrigin = origin.replace(/\/+$/, '').toLowerCase();
        const allowedOrigins = env_1.env.CORS_ORIGINS.map((o) => o.replace(/\/+$/, '').toLowerCase());
        if (allowedOrigins.includes('*') ||
            allowedOrigins.includes(cleanOrigin) ||
            cleanOrigin === 'https://test-three-mu-12.vercel.app' ||
            cleanOrigin === 'https://aagarathirupthiprovider.vercel.app' ||
            cleanOrigin.endsWith('.vercel.app')) {
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
app.use((0, cors_1.default)(corsOptions));
app.options('*', (0, cors_1.default)(corsOptions));
// Request ID header middleware
app.use((req, res, next) => {
    const reqId = req.headers['x-request-id'] || crypto_1.default.randomUUID();
    req.id = reqId;
    res.setHeader('X-Request-Id', reqId);
    next();
});
// Static file serving for local uploads driver
const uploadsDir = path_1.default.resolve(process.cwd(), 'uploads');
app.use('/static/uploads', express_1.default.static(uploadsDir));
// Body parsing with 1MB limit
app.use(express_1.default.json({ limit: '1mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '1mb' }));
// Sanitize MongoDB operators to prevent injection
app.use((0, express_mongo_sanitize_1.default)());
// Global Rate Limiter (skip in testing environment)
if (env_1.env.NODE_ENV !== 'test') {
    app.use(rateLimiters_1.globalLimiter);
}
// Role Context Resolution (X-App-Role / JWT)
app.use(roleContext_1.roleContext);
// Dynamic Case Transformation for Provider Role
app.use(caseTransform_1.caseTransform);
// Central API Router
app.use('/api/v1', index_1.default);
// 404 Catch-all
app.use(notFound_1.notFound);
// Central Error Handler
app.use(errorHandler_1.errorHandler);
