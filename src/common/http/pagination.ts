export interface PaginationOptions {
  page?: number;
  limit?: number;
}

export interface NormalizedPagination {
  page: number;
  limit: number;
  skip: number;
}

export function parsePagination(
  query: Record<string, unknown>,
  defaultLimit = 20,
  maxLimit = 100
): NormalizedPagination {
  const page = Math.max(1, parseInt(String(query.page || 1), 10) || 1);
  const rawLimit = parseInt(String(query.limit || defaultLimit), 10) || defaultLimit;
  const limit = Math.min(maxLimit, Math.max(1, rawLimit));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

export interface PaginationMeta {
  total: number;
  page: number;
  totalPages: number;
  limit?: number;
}

export function buildPaginationMeta(total: number, page: number, limit: number): PaginationMeta {
  const totalPages = Math.ceil(total / limit) || 1;
  return {
    total,
    page,
    totalPages,
    limit,
  };
}
