"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePagination = parsePagination;
exports.buildPaginationMeta = buildPaginationMeta;
function parsePagination(query, defaultLimit = 20, maxLimit = 100) {
    const page = Math.max(1, parseInt(String(query.page || 1), 10) || 1);
    const rawLimit = parseInt(String(query.limit || defaultLimit), 10) || defaultLimit;
    const limit = Math.min(maxLimit, Math.max(1, rawLimit));
    const skip = (page - 1) * limit;
    return { page, limit, skip };
}
function buildPaginationMeta(total, page, limit) {
    const totalPages = Math.ceil(total / limit) || 1;
    return {
        total,
        page,
        totalPages,
        limit,
    };
}
