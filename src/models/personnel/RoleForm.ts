import type { FormRules } from 'element-plus'
import { PersonnelForm } from './PersonnelForm'

export type RoleStatus = 'active' | 'inactive'
export type PermissionAction = 'view' | 'create' | 'update' | 'delete'

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
    create: '新增',
    update: '编辑',
    delete: '删除',
  }

  static readonly PAGE_DEFINITIONS: PageDefinition[] = [
    { pageKey: 'home', pageName: '首页', module: '门户', path: '/home', actions: ['view'] },
    {
      pageKey: 'about',
      pageName: '关于',
      module: '门户',
      path: '/portal/about',
      actions: ['view'],
    },
    {
      pageKey: 'contact',
      pageName: '联系单',
      module: '业务系统',
      path: '/business/contact',
      actions: ['view', 'create', 'update', 'delete'],
    },
    {
      pageKey: 'project',
      pageName: '项目',
      module: '业务系统',
      path: '/business/project',
      actions: ['view', 'create', 'update', 'delete'],
    },
    {
      pageKey: 'schedule',
      pageName: '工作安排',
      module: '业务系统',
      path: '/business/schedule',
      actions: ['view'],
    },
    {
      pageKey: 'person',
      pageName: '人员',
      module: '人员系统',
      path: '/personnel/person',
      actions: ['view', 'create', 'update', 'delete'],
    },
    {
      pageKey: 'role',
      pageName: '角色',
      module: '人员系统',
      path: '/personnel/role',
      actions: ['view', 'create', 'update', 'delete'],
    },
    {
      pageKey: 'leave',
      pageName: '休假',
      module: '人员系统',
      path: '/personnel/leave',
      actions: ['view'],
    },
    {
      pageKey: 'system-settings',
      pageName: '全局配置',
      module: '系统设置',
      path: '/system/settings',
      actions: ['view', 'update'],
    },
  ]

  static readonly CRUD_ACTIONS: PermissionAction[] = ['view', 'create', 'update', 'delete']
  static readonly VIEW_ACTIONS: PermissionAction[] = ['view']
  static readonly ACTION_ORDER: PermissionAction[] = ['view', 'create', 'update', 'delete']

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

  static buildPermissionCatalog(): PermissionRecord[] {
    const catalog: PermissionRecord[] = []
    let index = 1

    for (const page of RoleForm.PAGE_DEFINITIONS) {
      for (const action of page.actions) {
        catalog.push({
          id: `PERM${String(index).padStart(3, '0')}`,
          code: `${page.pageKey}:${action}`,
          name: RoleForm.ACTION_LABELS[action],
          module: page.module,
          pageKey: page.pageKey,
          pageName: page.pageName,
          path: page.path,
          action,
        })
        index += 1
      }
    }

    return catalog
  }

  static readonly PERMISSION_CATALOG: PermissionRecord[] = RoleForm.buildPermissionCatalog()

  static buildPagePermissions(
    pages: Array<{ pageKey: string; actions: PermissionAction[] }>,
  ): string[] {
    return RoleForm.PERMISSION_CATALOG.filter((permission) =>
      pages.some(
        (page) => page.pageKey === permission.pageKey && page.actions.includes(permission.action),
      ),
    ).map((permission) => permission.id)
  }

  static readonly PERMISSION_SET = {
    ALL: RoleForm.PERMISSION_CATALOG.map((item) => item.id),
    BIZ_LEAD: RoleForm.buildPagePermissions([
      { pageKey: 'home', actions: RoleForm.VIEW_ACTIONS },
      { pageKey: 'about', actions: RoleForm.VIEW_ACTIONS },
      { pageKey: 'contact', actions: RoleForm.CRUD_ACTIONS },
      { pageKey: 'project', actions: RoleForm.CRUD_ACTIONS },
      { pageKey: 'schedule', actions: RoleForm.VIEW_ACTIONS },
    ]),
    BIZ_VIEW: RoleForm.buildPagePermissions([
      { pageKey: 'home', actions: RoleForm.VIEW_ACTIONS },
      { pageKey: 'contact', actions: RoleForm.VIEW_ACTIONS },
      { pageKey: 'project', actions: RoleForm.VIEW_ACTIONS },
      { pageKey: 'schedule', actions: RoleForm.VIEW_ACTIONS },
    ]),
  } as const

  static readonly ROLE_SEEDS = [
    {
      id: 'ROLE001',
      name: '系统管理员',
      code: 'admin',
      description: '科室负责人，拥有全部页面权限，含系统设置',
      status: 'active' as RoleStatus,
      permissionIds: [...RoleForm.PERMISSION_SET.ALL],
      personnelIds: ['PER009'],
    },
    {
      id: 'ROLE003',
      name: '设计组组长',
      code: 'design-lead',
      description: '业务页面可增删改查，工作安排仅查看',
      status: 'active' as RoleStatus,
      permissionIds: [...RoleForm.PERMISSION_SET.BIZ_LEAD],
      personnelIds: ['PER004'],
    },
    {
      id: 'ROLE004',
      name: '设计工程师',
      code: 'designer',
      description: '业务页面仅查看，不可新增或修改',
      status: 'active' as RoleStatus,
      permissionIds: [...RoleForm.PERMISSION_SET.BIZ_VIEW],
      personnelIds: ['PER001', 'PER002', 'PER003', 'PER005', 'PER006', 'PER007', 'PER008'],
    },
    {
      id: 'ROLE005',
      name: '细化组组长',
      code: 'detail-lead',
      description: '业务页面可增删改查，工作安排仅查看',
      status: 'active' as RoleStatus,
      permissionIds: [...RoleForm.PERMISSION_SET.BIZ_LEAD],
      personnelIds: ['PER010'],
    },
    {
      id: 'ROLE006',
      name: '细化工程师',
      code: 'detailer',
      description: '业务页面仅查看，不可新增或修改',
      status: 'active' as RoleStatus,
      permissionIds: [...RoleForm.PERMISSION_SET.BIZ_VIEW],
      personnelIds: [
        'PER011',
        'PER012',
        'PER013',
        'PER014',
        'PER015',
        'PER016',
        'PER017',
        'PER018',
        'PER019',
        'PER020',
        'PER021',
        'PER022',
      ],
    },
  ]

  static buildAssignees(personnelIds: string[]): {
    assignedPersonnelIds: string[]
    assignedPersonnel: RoleAssignee[]
  } {
    const personnelMap = new Map(
      PersonnelForm.DEFAULT_SAMPLES.map((person) => [person.id, person]),
    )

    const assignedPersonnel = personnelIds
      .map((id) => personnelMap.get(id))
      .filter((person): person is NonNullable<typeof person> => !!person)
      .map((person) => ({
        id: person.id,
        name: person.name,
        team: person.team,
      }))

    return {
      assignedPersonnelIds: assignedPersonnel.map((person) => person.id),
      assignedPersonnel,
    }
  }

  static buildDefaultSamples(): RoleRecord[] {
    return RoleForm.ROLE_SEEDS.map((seed) => {
      const permissions = RoleForm.PERMISSION_CATALOG.filter((item) =>
        seed.permissionIds.includes(item.id),
      )
      const assignees = RoleForm.buildAssignees(seed.personnelIds)

      return {
        id: seed.id,
        name: seed.name,
        code: seed.code,
        description: seed.description,
        status: seed.status,
        permissionIds: [...seed.permissionIds],
        permissions,
        ...assignees,
      }
    })
  }

  static readonly DEFAULT_SAMPLES: RoleRecord[] = RoleForm.buildDefaultSamples()

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
