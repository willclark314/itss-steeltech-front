import type { FormRules } from 'element-plus'

export type RoleStatus = 'active' | 'inactive'
export type PermissionAction = 'view' | 'edit'

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
  assignedPersonnelIds: string[]
}

type PageDefinition = {
  pageKey: string
  pageName: string
  module: string
  path: string
  actions: PermissionAction[]
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

  static readonly ACTION_LABELS: Record<PermissionAction, string> = {
    view: '查看',
    edit: '编辑',
  }

  static readonly PAGE_DEFINITIONS: PageDefinition[] = [
    { pageKey: 'home', pageName: '首页', module: '门户', path: '/home', actions: ['view', 'edit'] },
    {
      pageKey: 'about',
      pageName: '关于',
      module: '门户',
      path: '/portal/about',
      actions: ['view', 'edit'],
    },
    {
      pageKey: 'contact',
      pageName: '联系单',
      module: '业务系统',
      path: '/business/contact',
      actions: ['view', 'edit'],
    },
    {
      pageKey: 'project',
      pageName: '项目',
      module: '业务系统',
      path: '/business/project',
      actions: ['view', 'edit'],
    },
    {
      pageKey: 'schedule',
      pageName: '工作安排',
      module: '业务系统',
      path: '/business/schedule',
      actions: ['view', 'edit'],
    },
    {
      pageKey: 'person',
      pageName: '人员',
      module: '人员系统',
      path: '/personnel/person',
      actions: ['view', 'edit'],
    },
    {
      pageKey: 'role',
      pageName: '角色',
      module: '人员系统',
      path: '/personnel/role',
      actions: ['view', 'edit'],
    },
    {
      pageKey: 'leave',
      pageName: '休假',
      module: '人员系统',
      path: '/personnel/leave',
      actions: ['view', 'edit'],
    },
    {
      pageKey: 'monthly-rest',
      pageName: '月休计划',
      module: '人员系统',
      path: '/personnel/monthly-rest',
      actions: ['view', 'edit'],
    },
    {
      pageKey: 'system-settings',
      pageName: '全局配置',
      module: '系统设置',
      path: '/system/settings',
      actions: ['view', 'edit'],
    },
  ]

  static readonly PAGE_ACTIONS: PermissionAction[] = ['view', 'edit']
  static readonly ACTION_ORDER: PermissionAction[] = ['view', 'edit']

  static readonly MODULE_ORDER: string[] = [
    ...new Set(RoleForm.PAGE_DEFINITIONS.map((page) => page.module)),
  ]

  private static readonly PAGE_ORDER_MAP = new Map(
    RoleForm.PAGE_DEFINITIONS.map((page, index) => [page.pageKey, index]),
  )

  private static readonly MODULE_ORDER_MAP = new Map(
    RoleForm.MODULE_ORDER.map((module, index) => [module, index]),
  )

  static compareModuleOrder(a: string, b: string) {
    const indexA = RoleForm.MODULE_ORDER_MAP.get(a) ?? Number.MAX_SAFE_INTEGER
    const indexB = RoleForm.MODULE_ORDER_MAP.get(b) ?? Number.MAX_SAFE_INTEGER
    if (indexA !== indexB) return indexA - indexB
    return a.localeCompare(b, 'zh-CN')
  }

  static comparePageOrder(a: string, b: string) {
    const indexA = RoleForm.PAGE_ORDER_MAP.get(a) ?? Number.MAX_SAFE_INTEGER
    const indexB = RoleForm.PAGE_ORDER_MAP.get(b) ?? Number.MAX_SAFE_INTEGER
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

  static cloneRecord(record: RoleRecord): RoleRecord {
    return {
      ...record,
      permissionIds: [...record.permissionIds],
      permissions: record.permissions.map((item) => ({ ...item })),
      assignedPersonnelIds: [...record.assignedPersonnelIds],
      assignedPersonnel: record.assignedPersonnel.map((item) => ({ ...item })),
    }
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

  static formatPermissionLabel(permission: PermissionRecord) {
    return `${permission.pageName}·${permission.name}`
  }

  static formatPagePermissionSummary(page: PagePermissionGroup) {
    const actions = page.permissions.map((item) => item.name).join('/')
    return actions ? `${page.pageName}(${actions})` : page.pageName
  }

  static createEmptyForm(): RoleFormData {
    return {
      id: '',
      name: '',
      code: '',
      description: '',
      status: RoleForm.STATUS.ACTIVE,
      permissionIds: [],
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
      assignedPersonnelIds: [...record.assignedPersonnelIds],
    }
  }
}
