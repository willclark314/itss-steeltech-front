import type { ApiContext } from './utils'

export interface ListPageQuery {
  pageSize: number
  page: number
  anchor?: string
}

export interface PaginatedWindowMeta {
  total: number
  pageSize: number
  page: number
  totalPages: number
}

export function parseListPageQuery(ctx: ApiContext): ListPageQuery {
  const pageSize = Math.min(
    100,
    Math.max(1, Number.parseInt(ctx.query.get('pageSize') || '20', 10) || 20),
  )
  const page = Math.max(1, Number.parseInt(ctx.query.get('page') || '1', 10) || 1)
  const anchor = ctx.query.get('anchor')?.trim() || undefined

  return { pageSize, page, anchor }
}

export function computePaginatedWindow(options: {
  total: number
  pageSize: number
  page?: number
  anchorIndex?: number
}): { offset: number; limit: number; page: number; totalPages: number } {
  const { total, pageSize } = options
  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 1

  let page = options.page ?? 1
  if (options.anchorIndex !== undefined && options.anchorIndex >= 0) {
    page = Math.floor(options.anchorIndex / pageSize) + 1
  }

  page = Math.min(Math.max(1, page), totalPages)

  if (total <= 0) {
    return { offset: 0, limit: 0, page: 1, totalPages: 1 }
  }

  const offset = (page - 1) * pageSize
  const limit = Math.min(pageSize, total - offset)

  return {
    offset,
    limit,
    page,
    totalPages,
  }
}
