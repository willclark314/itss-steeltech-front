import { ref } from 'vue'
import { DEFAULT_PAGE_SIZE } from '@/constants/pagination'

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
  flowFilters?: string[]
  natures?: string[]
  personnelTeam?: string
  excludeProjectNos?: string[]
  modelType?: string
}

export interface PaginatedListCacheOptions<T> {
  pageSize?: number
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

  const pageSize = ref(options.pageSize ?? DEFAULT_PAGE_SIZE)
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
    return `${serializeFilters(filters)}::size::${pageSize.value}::page::${pageNo}`
  }

  function buildAnchorKey(anchor: string, filters: ListFilters = listFilters) {
    return `${serializeFilters(filters)}::size::${pageSize.value}::anchor::${anchor}`
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
    const pageKeyMarker = `::size::${pageSize.value}::page::`
    const pages: PaginatedListResult<T>[] = []

    for (const [key, cached] of pageCache.entries()) {
      if (!key.startsWith(`${filterPrefix}${pageKeyMarker}`)) continue
      if (key.includes('::merged::')) continue
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

  function shouldPickFirst(a: T, b: T) {
    if (!options.sortList) return true
    return options.sortList([a, b])[0] === a
  }

  /** 跨筛选桶收集已缓存记录（去重） */
  function getGlobalCachedItems() {
    const merged = new Map<string, T>()
    for (const cached of pageCache.values()) {
      for (const item of cached.list) {
        merged.set(options.getItemKey(item), item)
      }
    }
    return normalizeList([...merged.values()])
  }

  /**
   * 列过滤（性质/流程）分页：服务端查询未缓存记录，与前端已缓存的匹配项合并排序后切片。
   * cachedMatching 由调用方从 getGlobalCachedItems 中筛出。
   */
  async function loadMergedFilteredPage(
    fetcher: (
      params: ListFilters & { page: number; pageSize: number },
    ) => Promise<PaginatedListResult<T>>,
    pageNo: number,
    nextFilters: ListFilters,
    cachedMatching: T[],
    force = false,
  ) {
    const { excludeProjectNos: _ignored, ...filtersWithoutExclude } = nextFilters
    listFilters = { ...filtersWithoutExclude }

    const sortedCached = normalizeList(cachedMatching)
    const excludeProjectNos = sortedCached.map(options.getItemKey)
    const cacheKey = `${buildPageKey(pageNo)}::merged::${excludeProjectNos.join(',')}`
    if (!force && pageCache.has(cacheKey)) {
      const cached = pageCache.get(cacheKey)!
      setDisplayState(cached)
      return cached
    }

    loading.value = true
    try {
      const fetchDbItemsFromOffset = async (dbOffset: number, count: number) => {
        if (count <= 0) return [] as T[]

        const items: T[] = []
        let remaining = count
        let offset = dbOffset

        while (remaining > 0) {
          const currentPage = Math.floor(offset / pageSize.value) + 1
          const skipInPage = offset % pageSize.value
          const result = await fetcher({
            ...listFilters,
            excludeProjectNos: excludeProjectNos.length ? excludeProjectNos : undefined,
            page: currentPage,
            pageSize: pageSize.value,
          })

          const slice = normalizeList(result.list).slice(skipInPage)
          if (!slice.length) break

          const take = Math.min(remaining, slice.length)
          items.push(...slice.slice(0, take))
          remaining -= take
          offset += take
        }

        return items
      }

      const probe = await fetcher({
        ...listFilters,
        excludeProjectNos: excludeProjectNos.length ? excludeProjectNos : undefined,
        page: 1,
        pageSize: 1,
      })
      const dbTotal = probe.total
      const totalCount = sortedCached.length + dbTotal
      const start = (pageNo - 1) * pageSize.value
      const end = Math.min(start + pageSize.value, totalCount)

      let cachedIndex = 0
      let dbConsumed = 0
      let dbBuffer: T[] = []
      const pageItems: T[] = []

      const ensureDbBuffer = async () => {
        if (dbBuffer.length || dbConsumed >= dbTotal) return
        const batch = await fetchDbItemsFromOffset(dbConsumed, Math.min(50, dbTotal - dbConsumed))
        dbBuffer = batch
      }

      for (let index = 0; index < end; index += 1) {
        await ensureDbBuffer()

        const cachedHead =
          cachedIndex < sortedCached.length ? sortedCached[cachedIndex]! : null
        const dbHead = dbBuffer[0] ?? null

        let pick: T | null = null
        if (cachedHead && dbHead) {
          pick = shouldPickFirst(cachedHead, dbHead) ? cachedHead : dbHead
        } else {
          pick = cachedHead ?? dbHead
        }
        if (!pick) break

        if (index >= start) {
          pageItems.push(pick)
        }

        if (pick === cachedHead) {
          cachedIndex += 1
        } else {
          dbBuffer.shift()
          dbConsumed += 1
        }
      }

      const result: PaginatedListResult<T> = {
        list: pageItems,
        total: totalCount,
        page: pageNo,
        pageSize: pageSize.value,
        totalPages: Math.max(1, Math.ceil(totalCount / pageSize.value)),
      }

      pageCache.set(cacheKey, result)
      bumpCacheRevision()
      setDisplayState(result)
      return result
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
        pageSize: pageSize.value,
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
        pageSize: pageSize.value,
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
    pageSize,
    filteredData,
    total,
    page,
    totalPages,
    loading,
    cacheRevision,
    loadPage,
    loadMergedFilteredPage,
    loadAll,
    loadAroundAnchor,
    clearCache,
    clearFilterCache,
    patchItem,
    getAccumulated,
    getAllList,
    getGlobalCachedItems,
    getFilters,
    setFilters,
  }
}
