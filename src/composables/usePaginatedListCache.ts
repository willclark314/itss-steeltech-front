import { ref } from 'vue'

export interface PaginatedListResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type ListFilters = {
  keyword?: string
  status?: string
  assignedPersonnelId?: string
  tags?: string[]
}

export interface PaginatedListCacheOptions<T> {
  pageSize: number
  getItemKey: (item: T) => string
  sortList?: (list: T[]) => T[]
}

function serializeFilters(filters: ListFilters) {
  const normalized: Record<string, string> = {}
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === '') continue
    if (Array.isArray(value)) {
      if (value.length) normalized[key] = value.join(',')
      continue
    }
    normalized[key] = value
  }
  return JSON.stringify(normalized)
}

export function usePaginatedListCache<T>(options: PaginatedListCacheOptions<T>) {
  const pageCache = new Map<string, PaginatedListResult<T>>()
  let listFilters: ListFilters = {}

  const filteredData = ref<T[]>([])
  const total = ref(0)
  const page = ref(1)
  const totalPages = ref(1)
  const loading = ref(false)
  /** 缓存变更计数，供分组等依赖合并缓存的计算属性追踪 */
  const cacheRevision = ref(0)

  function bumpCacheRevision() {
    cacheRevision.value += 1
  }

  function buildPageKey(pageNo: number, filters: ListFilters = listFilters) {
    return `${serializeFilters(filters)}::page::${pageNo}`
  }

  function buildAnchorKey(anchor: string, filters: ListFilters = listFilters) {
    return `${serializeFilters(filters)}::anchor::${anchor}`
  }

  function buildAllKey(filters: ListFilters = listFilters) {
    return `${serializeFilters(filters)}::all`
  }

  function normalizeList(list: T[]) {
    return options.sortList ? options.sortList([...list]) : [...list]
  }

  function setDisplayState(result: PaginatedListResult<T>) {
    filteredData.value = normalizeList(result.list)
    total.value = result.total
    page.value = result.page
    totalPages.value = result.totalPages
  }

  function persistPageResult(result: PaginatedListResult<T>, filters: ListFilters = listFilters) {
    const list = normalizeList(result.list)
    pageCache.set(buildPageKey(result.page, filters), {
      ...result,
      list,
    })
    bumpCacheRevision()
    return list
  }

  function applyResult(result: PaginatedListResult<T>) {
    const list = persistPageResult(result)
    setDisplayState({ ...result, list })
  }

  function getFilters() {
    return { ...listFilters }
  }

  function setFilters(nextFilters: ListFilters) {
    listFilters = { ...nextFilters }
  }

  /** 仅清除指定筛选条件下的缓存，保留其他筛选桶 */
  function clearFilterCache(filters: ListFilters = listFilters) {
    const prefix = serializeFilters(filters)
    let removed = false
    for (const key of [...pageCache.keys()]) {
      if (!key.startsWith(`${prefix}::`)) continue
      pageCache.delete(key)
      removed = true
    }
    if (removed) bumpCacheRevision()
  }

  /** 合并当前筛选条件下已缓存各页记录（用于分组展示） */
  function getAccumulated(filters: ListFilters = listFilters) {
    const filterPrefix = serializeFilters(filters)
    const pages: PaginatedListResult<T>[] = []

    for (const [key, cached] of pageCache.entries()) {
      if (!key.startsWith(`${filterPrefix}::page::`)) continue
      pages.push(cached)
    }

    pages.sort((a, b) => a.page - b.page)
    const merged = new Map<string, T>()
    for (const cached of pages) {
      for (const item of cached.list) {
        merged.set(options.getItemKey(item), item)
      }
    }
    return normalizeList([...merged.values()])
  }

  /** 读取当前筛选桶内已缓存的全量列表（分组视图使用） */
  function getAllList(filters: ListFilters = listFilters) {
    const cached = pageCache.get(buildAllKey(filters))
    return cached ? normalizeList(cached.list) : []
  }

  async function loadAll(
    fetcher: (params: ListFilters) => Promise<PaginatedListResult<T>>,
    nextFilters?: ListFilters,
    force = false,
  ) {
    if (nextFilters) {
      listFilters = { ...nextFilters }
    }

    const cacheKey = buildAllKey()
    if (!force && pageCache.has(cacheKey)) {
      const cached = pageCache.get(cacheKey)!
      total.value = cached.total
      bumpCacheRevision()
      return cached
    }

    loading.value = true
    try {
      const result = await fetcher({ ...listFilters })
      const list = normalizeList(result.list)
      const stored: PaginatedListResult<T> = {
        ...result,
        list,
        page: 1,
        pageSize: list.length,
        totalPages: 1,
      }
      pageCache.set(cacheKey, stored)
      total.value = result.total
      bumpCacheRevision()
      return stored
    } finally {
      loading.value = false
    }
  }

  async function loadPage(
    fetcher: (params: ListFilters & { page: number; pageSize: number }) => Promise<PaginatedListResult<T>>,
    pageNo = 1,
    nextFilters?: ListFilters,
    force = false,
  ) {
    if (nextFilters) {
      listFilters = { ...nextFilters }
    }

    const cacheKey = buildPageKey(pageNo)
    if (!force && pageCache.has(cacheKey)) {
      const cached = pageCache.get(cacheKey)!
      setDisplayState(cached)
      return cached
    }

    loading.value = true
    try {
      const result = await fetcher({
        ...listFilters,
        page: pageNo,
        pageSize: options.pageSize,
      })
      applyResult(result)
      return result
    } finally {
      loading.value = false
    }
  }

  async function loadAroundAnchor(
    fetcher: (params: ListFilters & { anchor: string; pageSize: number }) => Promise<PaginatedListResult<T>>,
    anchor: string,
    nextFilters?: ListFilters,
    force = false,
  ) {
    if (nextFilters) {
      listFilters = { ...nextFilters }
    }

    const anchorKey = buildAnchorKey(anchor)
    if (!force && pageCache.has(anchorKey)) {
      const cached = pageCache.get(anchorKey)!
      setDisplayState(cached)
      return cached
    }

    loading.value = true
    try {
      const result = await fetcher({
        ...listFilters,
        anchor,
        pageSize: options.pageSize,
      })
      const list = normalizeList(result.list)
      pageCache.set(anchorKey, { ...result, list })
      persistPageResult({ ...result, list })
      setDisplayState({ ...result, list })
      return result
    } finally {
      loading.value = false
    }
  }

  function clearCache() {
    pageCache.clear()
    bumpCacheRevision()
  }

  function patchItem(key: string, updater: (item: T) => T) {
    const currentIndex = filteredData.value.findIndex((item) => options.getItemKey(item as T) === key)
    if (currentIndex !== -1) {
      const current = filteredData.value[currentIndex] as T
      filteredData.value[currentIndex] = updater(current) as (typeof filteredData.value)[number]
    }

    for (const [cacheKey, cached] of pageCache.entries()) {
      const index = cached.list.findIndex((item) => options.getItemKey(item) === key)
      if (index === -1) continue

      const nextList = [...cached.list]
      nextList[index] = updater(nextList[index]!)
      pageCache.set(cacheKey, {
        ...cached,
        list: nextList,
      })
    }
    bumpCacheRevision()
  }

  return {
    filteredData,
    total,
    page,
    totalPages,
    loading,
    cacheRevision,
    loadPage,
    loadAll,
    loadAroundAnchor,
    clearCache,
    clearFilterCache,
    patchItem,
    getAccumulated,
    getAllList,
    getFilters,
    setFilters,
  }
}
