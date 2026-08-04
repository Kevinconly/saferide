export interface PaginationParams {
  page: number
  pageSize: number
}

export interface PageMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
  hasMore: boolean
}

export function getPaginationParams(query: {
  page?: unknown
  pageSize?: unknown
}): PaginationParams {
  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10) || 1)
  const pageSize = Math.min(100, Math.max(1, parseInt(String(query.pageSize ?? '20'), 10) || 20))
  return { page, pageSize }
}

export function buildPageMeta(
  params: PaginationParams,
  total: number,
): PageMeta {
  const totalPages = total === 0 ? 0 : Math.ceil(total / params.pageSize)
  return {
    page: params.page,
    pageSize: params.pageSize,
    total,
    totalPages,
    hasMore: params.page < totalPages,
  }
}
