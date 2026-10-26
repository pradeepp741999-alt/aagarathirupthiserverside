"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.respond = void 0;
exports.respond = {
    ok(req, res, payload, opts) {
        return sendResponse(req, res, 200, payload, opts);
    },
    created(req, res, payload, opts) {
        return sendResponse(req, res, 201, payload, opts);
    },
    list(req, res, items, meta, opts) {
        const totalPages = Math.ceil(meta.total / meta.limit) || 1;
        const paginationMeta = {
            total: meta.total,
            page: meta.page,
            totalPages,
        };
        if (req.appRole === 'provider' || req.appRole === 'admin') {
            return sendResponse(req, res, 200, items, {
                ...opts,
                meta: paginationMeta,
            });
        }
        // For user app, if items is expected directly or wrapped with meta
        return sendResponse(req, res, 200, items, opts);
    },
    message(req, res, message, statusCode = 200) {
        if (req.appRole === 'provider' || req.appRole === 'admin') {
            return res.status(statusCode).json({
                success: true,
                message,
            });
        }
        return res.status(statusCode).json({
            success: true,
            message,
        });
    },
};
function sendResponse(req, res, statusCode, payload, opts) {
    const isProviderOrAdmin = req.appRole === 'provider' || req.appRole === 'admin';
    if (isProviderOrAdmin) {
        const body = {
            success: true,
        };
        if (payload !== undefined) {
            body.data = payload;
        }
        if (opts?.message) {
            body.message = opts.message;
        }
        if (opts?.meta) {
            body.meta = opts.meta;
        }
        if (opts?.extraTopLevel) {
            Object.assign(body, opts.extraTopLevel);
        }
        return res.status(statusCode).json(body);
    }
    // User role response: raw payload
    if (payload === undefined && opts?.message) {
        return res.status(statusCode).json({
            success: true,
            message: opts.message,
        });
    }
    return res.status(statusCode).json(payload);
}
