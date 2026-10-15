import { ref } from 'vue'
import {
  APP_PAGES,
  APP_SYSTEMS,
  type AppPageDefinition,
  type AppSystemDefinition,
  type AppSystemId,
} from '@/models/navigation/appNavigation'
import { fetchNavigationOrder, updateNavigationOrder } from '@/api/system'

export interface NavigationOrderConfig {
  systems: AppSystemId[]
  pages: string[]
  /** 不在侧栏/顶部系统中展示的页面 */
  hiddenPages: string[]
}

/** 页面配置中不可关闭展示，避免无法再进入配置页 */
export const ALWAYS_VISIBLE_PAGES = new Set(['page-config'])

const navigationOrder = ref<NavigationOrderConfig | null>(null)
let loadingPromise: Promise<NavigationOrderConfig> | null = null

const SYSTEM_MODULE_MAP: Record<AppSystemId, string> = {
  portal: '门户',
  business: '钢构技术系统',
  production: '生产计划系统',
  personnel: '人员系统',
  system: '系统设置',
  development: '开发',
}

export function getDefaultNavigationOrder(): NavigationOrderConfig {
  return {
    systems: APP_SYSTEMS.map((system) => system.id),
    pages: APP_PAGES.map((page) => page.pageKey),
    hiddenPages: [],
  }
}

export function getNavigationOrderRef() {
  return navigationOrder
}

export function getEffectiveNavigationOrder(): NavigationOrderConfig {
  return navigationOrder.value ?? getDefaultNavigationOrder()
}

export function setNavigationOrder(config: NavigationOrderConfig) {
  navigationOrder.value = config
}

function normalizeHiddenPages(hiddenPages: string[] | undefined | null): string[] {
  const knownPages = new Set(APP_PAGES.map((page) => page.pageKey))
  const result: string[] = []
  const seen = new Set<string>()
  for (const raw of hiddenPages ?? []) {
    const pageKey = String(raw || '').trim()
    if (!pageKey || !knownPages.has(pageKey) || ALWAYS_VISIBLE_PAGES.has(pageKey) || seen.has(pageKey)) {
      continue
    }
    seen.add(pageKey)
    result.push(pageKey)
  }
  return result
}

function normalizeNavigationOrder(config: {
  systems: AppSystemId[] | string[]
  pages: string[]
  hiddenPages?: string[] | null
}): NavigationOrderConfig {
  return {
    systems: config.systems as AppSystemId[],
    pages: config.pages,
    hiddenPages: normalizeHiddenPages(config.hiddenPages),
  }
}

function getSystemPageKeys(systemId: AppSystemId): string[] {
  return APP_PAGES.filter((page) => page.systemId === systemId).map((page) => page.pageKey)
}

export function getPagesForSystem(pageKeys: string[], systemId: AppSystemId): string[] {
  const systemKeySet = new Set(getSystemPageKeys(systemId))
  return pageKeys.filter((key) => systemKeySet.has(key))
}

export function setPagesForSystem(
  pageKeys: string[],
  systemId: AppSystemId,
  nextSystemPageKeys: string[],
): string[] {
  const systemKeySet = new Set(getSystemPageKeys(systemId))
  const firstIndex = pageKeys.findIndex((key) => systemKeySet.has(key))
  const before = pageKeys.slice(0, firstIndex).filter((key) => !systemKeySet.has(key))
  const after = pageKeys.slice(firstIndex).filter((key) => !systemKeySet.has(key))
  if (firstIndex === -1) {
    return [...pageKeys, ...nextSystemPageKeys]
  }
  return [...before, ...nextSystemPageKeys, ...after]
}

export function applySystemOrder(
  config: NavigationOrderConfig,
  nextSystems: AppSystemId[],
): NavigationOrderConfig {
  const pagesBySystem = new Map<AppSystemId, string[]>()
  for (const systemId of config.systems) {
    pagesBySystem.set(systemId, getPagesForSystem(config.pages, systemId))
  }

  const pages: string[] = []
  for (const systemId of nextSystems) {
    const systemPages = pagesBySystem.get(systemId) ?? getSystemPageKeys(systemId)
    pages.push(...systemPages)
  }

  return {
    systems: nextSystems,
    pages,
    hiddenPages: [...config.hiddenPages],
  }
}

export function isPageVisibleInNavigation(
  pageKey: string,
  order?: NavigationOrderConfig | null,
): boolean {
  if (ALWAYS_VISIBLE_PAGES.has(pageKey)) return true
  const effectiveOrder = order ?? getEffectiveNavigationOrder()
  return !effectiveOrder.hiddenPages.includes(pageKey)
}

export function sortPagesByNavigationOrder(
  pages: AppPageDefinition[],
  order?: NavigationOrderConfig | null,
): AppPageDefinition[] {
  const effectiveOrder = order ?? getEffectiveNavigationOrder()
  const pageIndex = new Map(effectiveOrder.pages.map((pageKey, index) => [pageKey, index]))
  return [...pages].sort((left, right) => {
    const leftIndex = pageIndex.get(left.pageKey) ?? Number.MAX_SAFE_INTEGER
    const rightIndex = pageIndex.get(right.pageKey) ?? Number.MAX_SAFE_INTEGER
    if (leftIndex !== rightIndex) return leftIndex - rightIndex
    return left.pageName.localeCompare(right.pageName, 'zh-CN')
  })
}

export function sortSystemsByNavigationOrder(
  systems: AppSystemDefinition[],
  order?: NavigationOrderConfig | null,
): AppSystemDefinition[] {
  const effectiveOrder = order ?? getEffectiveNavigationOrder()
  const systemIndex = new Map(effectiveOrder.systems.map((systemId, index) => [systemId, index]))
  return [...systems].sort((left, right) => {
    const leftIndex = systemIndex.get(left.id) ?? Number.MAX_SAFE_INTEGER
    const rightIndex = systemIndex.get(right.id) ?? Number.MAX_SAFE_INTEGER
    if (leftIndex !== rightIndex) return leftIndex - rightIndex
    return left.name.localeCompare(right.name, 'zh-CN')
  })
}

export function getPageOrderMap(order?: NavigationOrderConfig | null) {
  const effectiveOrder = order ?? getEffectiveNavigationOrder()
  return new Map(effectiveOrder.pages.map((pageKey, index) => [pageKey, index]))
}

export function getModuleOrder(order?: NavigationOrderConfig | null) {
  const effectiveOrder = order ?? getEffectiveNavigationOrder()
  const modules: string[] = []
  const seen = new Set<string>()
  for (const systemId of effectiveOrder.systems) {
    const moduleName = SYSTEM_MODULE_MAP[systemId]
    if (!moduleName || seen.has(moduleName)) continue
    seen.add(moduleName)
    modules.push(moduleName)
  }
  return modules
}

export function getModuleOrderMap(order?: NavigationOrderConfig | null) {
  return new Map(getModuleOrder(order).map((module, index) => [module, index]))
}

export async function loadNavigationOrder(force = false): Promise<NavigationOrderConfig> {
  if (!force && navigationOrder.value) {
    return navigationOrder.value
  }
  if (!force && loadingPromise) {
    return loadingPromise
  }

  loadingPromise = fetchNavigationOrder()
    .then((response) => {
      const config = normalizeNavigationOrder({
        systems: response.systems as AppSystemId[],
        pages: response.pages,
        hiddenPages: response.hiddenPages,
      })
      navigationOrder.value = config
      return config
    })
    .catch(() => {
      const fallback = getDefaultNavigationOrder()
      navigationOrder.value = fallback
      return fallback
    })
    .finally(() => {
      loadingPromise = null
    })

  return loadingPromise
}

export async function saveNavigationOrder(config: NavigationOrderConfig) {
  const response = await updateNavigationOrder({
    systems: config.systems,
    pages: config.pages,
    hiddenPages: config.hiddenPages,
  })
  const nextConfig = normalizeNavigationOrder({
    systems: response.systems as AppSystemId[],
    pages: response.pages,
    hiddenPages: response.hiddenPages,
  })
  navigationOrder.value = nextConfig
  return nextConfig
}

export function buildOrderedAccessiblePages(
  pages: AppPageDefinition[],
  extraPages: AppPageDefinition[] = [],
): AppPageDefinition[] {
  const ordered = sortPagesByNavigationOrder(pages).filter((page) =>
    isPageVisibleInNavigation(page.pageKey),
  )
  if (!extraPages.length) return ordered
  return [...ordered, ...extraPages]
}
