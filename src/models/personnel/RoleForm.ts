import type { FormRules } from 'element-plus'
import { APP_PAGES } from '@/models/navigation/appNavigation'
import { getModuleOrderMap, getPageOrderMap } from '@/utils/navigationOrder'
import { PersonnelForm } from './PersonnelForm'

export type RoleStatus = 'active' | 'inactive'
export type PermissionAction = 'view' | 'view-all' | 'edit'

export interface PermissionRecord {
  id: string
  code: string
  name: string
  module: string
  pageKey: string
  pageName: string
  path: string
  action: PermissionAction
}

export interface PagePermissionGroup {
  pageKey: string
  pageName: string
  module: string
  path: string
  permissions: PermissionRecord[]
}

export interface ModulePermissionGroup {
  module: string
  pages: PagePermissionGroup[]
}

export interface RoleAssignee {
  id: string
  name: string
  team: string
}

export interface RoleRecord {
  id: string
  name: string
  code: string
  description: string
  status: RoleStatus
  permissionIds: string[]
  permissions: PermissionRecord[]
  assignedWorkshops: string[]
  assignedPersonnelIds: string[]
  assignedPersonnel: RoleAssignee[]
}

export interface RoleFilterParams {
  keyword?: string
  status?: string
}

export interface RoleFormData {
  id: string
  name: string
  code: string
  description: string
  status: RoleStatus
  permissionIds: string[]
  assignedWorkshops: string[]
  assignedPersonnelIds: string[]
}

export class RoleForm {
  static readonly STATUS = {
    ACTIVE: 'active',
    INACTIVE: 'inactive',
  } as const

  static readonly STATUS_OPTIONS = [
    { label: '全部', value: '' },
    { label: '启用', value: RoleForm.STATUS.ACTIVE },
    { label: '停用', value: RoleForm.STATUS.INACTIVE },
  ]

  static readonly STATUS_FORM_OPTIONS = RoleForm.STATUS_OPTIONS.filter((item) => item.value)

  static readonly STATUS_MAP: Record<
    RoleStatus,
    { label: string; type: 'success' | 'info' }
  > = {
    active: { label: '启用', type: 'success' },
    inactive: { label: '停用', type: 'info' },
  }

  static readonly FORM_RULES: FormRules = {
    name: [{ required: true, message: '请输入角色名称', trigger: 'blur' }],
    code: [{ required: true, message: '请输入角色编码', trigger: 'blur' }],
  }

  static readonly ACTION_ORDER: PermissionAction[] = ['view', 'view-all', 'edit']

  static readonly MODULE_ORDER: string[] = [...new Set(APP_PAGES.map((page) => page.module))]

  static compareModuleOrder(a: string, b: string) {
    const moduleOrderMap = getModuleOrderMap()
    const indexA = moduleOrderMap.get(a) ?? Number.MAX_SAFE_INTEGER
    const indexB = moduleOrderMap.get(b) ?? Number.MAX_SAFE_INTEGER
    if (indexA !== indexB) return indexA - indexB
    return a.localeCompare(b, 'zh-CN')
  }

  static comparePageOrder(a: string, b: string) {
    const pageOrderMap = getPageOrderMap()
    const indexA = pageOrderMap.get(a) ?? Number.MAX_SAFE_INTEGER
    const indexB = pageOrderMap.get(b) ?? Number.MAX_SAFE_INTEGER
    if (indexA !== indexB) return indexA - indexB
    return a.localeCompare(b, 'zh-CN')
  }

  static sortPermissions(permissions: PermissionRecord[]): PermissionRecord[] {
    const actionOrder = RoleForm.ACTION_ORDER
    return [...permissions].sort((a, b) => {
      const moduleCompare = RoleForm.compareModuleOrder(a.module, b.module)
      if (moduleCompare !== 0) return moduleCompare

      const pageCompare = RoleForm.comparePageOrder(a.pageKey, b.pageKey)
      if (pageCompare !== 0) return pageCompare

      return actionOrder.indexOf(a.action) - actionOrder.indexOf(b.action)
    })
  }

  static filter(records: RoleRecord[], { keyword = '', status = '' }: RoleFilterParams = {}) {
    const normalizedKeyword = keyword.trim().toLowerCase()

    return records.filter((item) => {
      const matchStatus = !status || item.status === status
      if (!normalizedKeyword) return matchStatus

      const searchable = [
        item.id,
        item.name,
        item.code,
        item.description,
        ...item.permissions.map(
          (permission) =>
            `${permission.module} ${permission.pageName} ${permission.name} ${permission.code} ${permission.action}`,
        ),
        ...item.assignedWorkshops.map((workshop) =>
          RoleForm.formatWorkshopLabel(workshop),
        ),
        ...item.assignedPersonnel.map((person) => `${person.name} ${person.team}`),
      ]
        .join(' ')
        .toLowerCase()

      return matchStatus && searchable.includes(normalizedKeyword)
    })
  }

  static groupPermissionsByPage(permissions: PermissionRecord[]): PagePermissionGroup[] {
    const pageMap = new Map<string, PagePermissionGroup>()

    for (const permission of RoleForm.sortPermissions(permissions)) {
      const existing = pageMap.get(permission.pageKey)
      if (existing) {
        existing.permissions.push(permission)
        continue
      }

      pageMap.set(permission.pageKey, {
        pageKey: permission.pageKey,
        pageName: permission.pageName,
        module: permission.module,
        path: permission.path,
        permissions: [permission],
      })
    }

    const actionOrder = RoleForm.ACTION_ORDER

    return [...pageMap.values()]
      .map((page) => ({
        ...page,
        permissions: [...page.permissions].sort(
          (a, b) => actionOrder.indexOf(a.action) - actionOrder.indexOf(b.action),
        ),
      }))
      .sort((a, b) => {
        const moduleCompare = RoleForm.compareModuleOrder(a.module, b.module)
        if (moduleCompare !== 0) return moduleCompare
        return RoleForm.comparePageOrder(a.pageKey, b.pageKey)
      })
  }

  static groupPermissionsByModule(permissions: PermissionRecord[]): ModulePermissionGroup[] {
    const moduleMap = new Map<string, PagePermissionGroup[]>()

    for (const page of RoleForm.groupPermissionsByPage(permissions)) {
      const list = moduleMap.get(page.module) ?? []
      list.push(page)
      moduleMap.set(page.module, list)
    }

    return [...moduleMap.entries()]
      .map(([module, pages]) => ({
        module,
        pages: [...pages].sort((a, b) => RoleForm.comparePageOrder(a.pageKey, b.pageKey)),
      }))
      .sort((a, b) => RoleForm.compareModuleOrder(a.module, b.module))
  }

  static getPagePermission(page: PagePermissionGroup, action: PermissionAction) {
    return page.permissions.find((item) => item.action === action)
  }

  static isPageAccessGranted(page: PagePermissionGroup, permissionIds: string[]) {
    const view = RoleForm.getPagePermission(page, 'view')
    return Boolean(view && permissionIds.includes(view.id))
  }

  static isPagePermissionGranted(page: PagePermissionGroup, permissionIds: string[]) {
    return page.permissions.some((item) => permissionIds.includes(item.id))
  }

  static groupAccessiblePagesByModule(
    allPermissions: PermissionRecord[],
    permissionIds: string[],
  ): ModulePermissionGroup[] {
    return RoleForm.groupPermissionsByModule(allPermissions)
      .map((group) => ({
        ...group,
        pages: group.pages.filter((page) =>
          RoleForm.isPagePermissionGranted(page, permissionIds),
        ),
      }))
      .filter((group) => group.pages.length > 0)
  }

  static getModuleViewPermissionIds(module: ModulePermissionGroup): string[] {
    return module.pages
      .map((page) => RoleForm.getPagePermission(page, 'view')?.id)
      .filter((id): id is string => Boolean(id))
  }

  static getModulePermissionIds(module: ModulePermissionGroup): string[] {
    return module.pages.flatMap((page) => page.permissions.map((item) => item.id))
  }

  static isModuleFullySelected(module: ModulePermissionGroup, permissionIds: string[]) {
    const total = module.pages.length
    if (!total) return false
    return RoleForm.countAccessiblePagesInModule(module, permissionIds) === total
  }

  static isModulePartiallySelected(module: ModulePermissionGroup, permissionIds: string[]) {
    const selected = RoleForm.countAccessiblePagesInModule(module, permissionIds)
    const total = module.pages.length
    return selected > 0 && selected < total
  }

  static isModuleAccessEnabled(module: ModulePermissionGroup, permissionIds: string[]) {
    return RoleForm.countAccessiblePagesInModule(module, permissionIds) > 0
  }

  static setModuleAccessEnabled(
    permissionIds: string[],
    module: ModulePermissionGroup,
    enabled: boolean,
  ): string[] {
    const moduleIds = new Set(RoleForm.getModulePermissionIds(module))
    const otherIds = permissionIds.filter((id) => !moduleIds.has(id))
    if (!enabled) return otherIds
    return [...otherIds, ...RoleForm.getModuleViewPermissionIds(module)]
  }

  static countAccessiblePagesInModule(module: ModulePermissionGroup, permissionIds: string[]) {
    return module.pages.filter((page) => RoleForm.isPageAccessGranted(page, permissionIds)).length
  }

  static countAccessiblePages(groups: ModulePermissionGroup[], permissionIds: string[]) {
    return groups.reduce(
      (sum, group) => sum + RoleForm.countAccessiblePagesInModule(group, permissionIds),
      0,
    )
  }

  /** 页面访问开关：开启授予 view，关闭移除该页面全部权限（含 view-all / 历史 edit） */
  static applyPageAccessToggle(
    permissionIds: string[],
    page: PagePermissionGroup,
    checked: boolean,
  ): string[] {
    const view = RoleForm.getPagePermission(page, 'view')
    const pageIds = page.permissions.map((item) => item.id)
    const next = new Set(permissionIds)
    if (checked) {
      if (view) next.add(view.id)
    } else {
      for (const id of pageIds) next.delete(id)
    }
    return [...next]
  }

  /** 页面除「查看」外的附加权限（如年休「查看全员」） */
  static getPageExtraPermissions(page: PagePermissionGroup): PermissionRecord[] {
    return page.permissions.filter((item) => item.action !== 'view')
  }

  static isPageExtraGranted(
    page: PagePermissionGroup,
    action: PermissionAction,
    permissionIds: string[],
  ): boolean {
    const perm = RoleForm.getPagePermission(page, action)
    return Boolean(perm && permissionIds.includes(perm.id))
  }

  /** 附加权限开关：勾选时自动带上页面 view */
  static applyPageExtraToggle(
    permissionIds: string[],
    page: PagePermissionGroup,
    action: PermissionAction,
    checked: boolean,
  ): string[] {
    const perm = RoleForm.getPagePermission(page, action)
    if (!perm) return permissionIds
    const next = new Set(permissionIds)
    if (checked) {
      next.add(perm.id)
      const view = RoleForm.getPagePermission(page, 'view')
      if (view) next.add(view.id)
    } else {
      next.delete(perm.id)
    }
    return [...next]
  }

  static formatPagePermissionLabel(page: PagePermissionGroup, permissionIds: string[]): string {
    const hasViewAll = RoleForm.isPageExtraGranted(page, 'view-all', permissionIds)
    if (hasViewAll) return `${page.pageName}（全员）`
    return page.pageName
  }

  static formatWorkshopLabel(workshop: string) {
    return PersonnelForm.formatWorkshopLabel(PersonnelForm.normalizeWorkshopKey(workshop))
  }

  static toApiWorkshops(workshopKeys: string[]) {
    return workshopKeys.map((key) =>
      key === PersonnelForm.EMPTY_WORKSHOP_KEY ? '' : key,
    )
  }

  static fromApiWorkshops(workshops: string[] = []) {
    return workshops.map((workshop) => PersonnelForm.normalizeWorkshopKey(workshop))
  }

  static createEmptyForm(): RoleFormData {
    return {
      id: '',
      name: '',
      code: '',
      description: '',
      status: RoleForm.STATUS.ACTIVE,
      permissionIds: [],
      assignedWorkshops: [],
      assignedPersonnelIds: [],
    }
  }

  static createFormFromRecord(record: RoleRecord): RoleFormData {
    return {
      id: record.id,
      name: record.name,
      code: record.code,
      description: record.description,
      status: record.status,
      permissionIds: [...record.permissionIds],
      assignedWorkshops: RoleForm.fromApiWorkshops(record.assignedWorkshops),
      assignedPersonnelIds: [...record.assignedPersonnelIds],
    }
  }
}
