import { ref, type Ref } from 'vue'

export interface PaginatedListResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface PaginatedFetchParams {
  page?: number
  pageSize?: number
  anchor?: string
  keyword?: string
  status?: string
}

export function usePaginatedList<T>(options: {
  pageSize?: number
  getItemKey: (item: T) => string
  fetchPage: (params: PaginatedFetchParams) => Promise<PaginatedListResult<T>>
}) {
  const pageSize = options.pageSize ?? 20
  const items = ref<T[]>([]) as Ref<T[]>
  const total = ref(0)
  const page = ref(1)
  const totalPages = ref(1)
  const loading = ref(false)

  const cache = new Map<string, PaginatedListResult<T>>()
  let filters: Pick<PaginatedFetchParams, 'keyword' | 'status'> = {}

  function buildCacheKey(pageNo: number, nextFilters = filters) {
    return JSON.stringify({ ...nextFilters, page: pageNo, pageSize })
  }

  function applyResult(result: PaginatedListResult<T>) {
    items.value = result.list
    total.value = result.total
    page.value = result.page
    totalPages.value = result.totalPages
    cache.set(buildCacheKey(result.page), {
      list: [...result.list],
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    })
  }

  async function loadPage(pageNo = 1, nextFilters?: typeof filters, force = false) {
    if (nextFilters) {
      const filtersChanged = JSON.stringify(nextFilters) !== JSON.stringify(filters)
      if (filtersChanged) {
        clearCache()
        filters = { ...nextFilters }
      }
    }

    const cacheKey = buildCacheKey(pageNo)
    if (!force && cache.has(cacheKey)) {
      applyResult(cache.get(cacheKey)!)
      return
    }

    loading.value = true
    try {
      const result = await options.fetchPage({
        ...filters,
        page: pageNo,
        pageSize,
      })
      applyResult(result)
    } finally {
      loading.value = false
    }
  }

  async function loadAroundAnchor(anchor: string, nextFilters?: typeof filters) {
    if (nextFilters) {
      filters = { ...nextFilters }
    }

    const cacheKey = `${JSON.stringify({ ...filters, pageSize })}::anchor::${anchor}`
    if (cache.has(cacheKey)) {
      applyResult(cache.get(cacheKey)!)
      return
    }

    loading.value = true
    try {
      const result = await options.fetchPage({
        ...filters,
        anchor,
        pageSize,
      })
      cache.set(cacheKey, {
        list: [...result.list],
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      })
      cache.set(buildCacheKey(result.page), {
        list: [...result.list],
        total: result.total,
        page: result.page,
        pageSize: result.pageSize,
        totalPages: result.totalPages,
      })
      applyResult(result)
    } finally {
      loading.value = false
    }
  }

  function clearCache() {
    cache.clear()
  }

  function patchItem(key: string, updater: (item: T) => T) {
    const currentIndex = items.value.findIndex((item) => options.getItemKey(item) === key)
    if (currentIndex !== -1) {
      items.value[currentIndex] = updater(items.value[currentIndex]!)
    }

    for (const [cacheKey, cached] of cache.entries()) {
      const index = cached.list.findIndex((item) => options.getItemKey(item) === key)
      if (index === -1) continue

      const nextList = [...cached.list]
      nextList[index] = updater(nextList[index]!)
      cache.set(cacheKey, {
        ...cached,
        list: nextList,
      })
    }
  }

  async function invalidateAndReload() {
    clearCache()
    await loadPage(page.value, filters, true)
  }

  return {
    items,
    total,
    page,
    totalPages,
    pageSize,
    loading,
    loadPage,
    loadAroundAnchor,
    clearCache,
    patchItem,
    invalidateAndReload,
  }
}
