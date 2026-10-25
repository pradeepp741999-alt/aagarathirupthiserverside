import { Request, Response } from 'express';
import { PaginationMeta } from './pagination';

export interface RespondOptions {
  message?: string;
  meta?: PaginationMeta;
  extraTopLevel?: Record<string, unknown>;
}

export const respond = {
  ok<T>(req: Request, res: Response, payload?: T, opts?: RespondOptions): Response {
    return sendResponse(req, res, 200, payload, opts);
  },

  created<T>(req: Request, res: Response, payload?: T, opts?: RespondOptions): Response {
    return sendResponse(req, res, 201, payload, opts);
  },

  list<T>(
    req: Request,
    res: Response,
    items: T[],
    meta: { page: number; limit: number; total: number },
    opts?: RespondOptions
  ): Response {
    const totalPages = Math.ceil(meta.total / meta.limit) || 1;
    const paginationMeta: PaginationMeta = {
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

  message(req: Request, res: Response, message: string, statusCode = 200): Response {
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

function sendResponse<T>(
  req: Request,
  res: Response,
  statusCode: number,
  payload?: T,
  opts?: RespondOptions
): Response {
  const isProviderOrAdmin = req.appRole === 'provider' || req.appRole === 'admin';

  if (isProviderOrAdmin) {
    const body: Record<string, unknown> = {
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
