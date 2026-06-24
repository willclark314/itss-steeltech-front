import type { FormRules } from 'element-plus'
import { BusinessSystemConfig } from '../BusinessSystemConfig'

export type ProjectStatus = 'active' | 'done' | 'paused'
export type ProjectNatureCode = 'design' | 'detail'

export interface ProjectAssignee {
  id: string
  name: string
  team: string
}

export interface ProjectRecord {
  projectNo: string
  name: string
  contactFormIds: string[]
  customer: string
  status: ProjectStatus
  natures: ProjectNatureCode[]
  assignedPersonnelIds: string[]
  assignedPersonnel: ProjectAssignee[]
  receivedDate: string
  plannedStartDate: string
  plannedEndDate: string
  actualStartDate: string
  actualEndDate: string
  localWorkPath: string
}

export interface ProjectFilterParams {
  keyword?: string
  status?: string
}

export type ProjectGroupBy = '' | 'nature' | 'personnel'

export interface ProjectRecordGroup {
  key: string
  label: string
  members: ProjectRecord[]
}

export interface ProjectFormData {
  projectNo: string
  name: string
  status: ProjectStatus
  natures: ProjectNatureCode[]
  assignedPersonnelIds: string[]
  plannedStartDate: string
  plannedEndDate: string
  actualStartDate: string
  actualEndDate: string
  localWorkPath: string
}

export class ProjectForm {
  static readonly STATUS = {
    ACTIVE: 'active',
    DONE: 'done',
    PAUSED: 'paused',
  } as const

  static readonly STATUS_OPTIONS = [
    { label: '全部', value: '' },
    { label: '进行中', value: ProjectForm.STATUS.ACTIVE },
    { label: '已完成', value: ProjectForm.STATUS.DONE },
    { label: '已暂停', value: ProjectForm.STATUS.PAUSED },
  ]

  static readonly STATUS_FORM_OPTIONS = ProjectForm.STATUS_OPTIONS.filter((item) => item.value)

  static readonly FORM_RULES: FormRules = {
    projectNo: [{ required: true, message: '请输入项目号', trigger: 'blur' }],
    name: [{ required: true, message: '请输入项目名称', trigger: 'blur' }],
  }

  static readonly STATUS_MAP: Record<
    ProjectStatus,
    { label: string; type: 'primary' | 'success' | 'warning' }
  > = {
    active: { label: '进行中', type: 'primary' },
    done: { label: '已完成', type: 'success' },
    paused: { label: '已暂停', type: 'warning' },
  }

  static readonly NATURE = {
    DESIGN: 'design',
    DETAIL: 'detail',
  } as const

  static readonly NATURE_OPTIONS = [
    { label: '设计', value: ProjectForm.NATURE.DESIGN },
    { label: '细化', value: ProjectForm.NATURE.DETAIL },
  ]

  static readonly NATURE_MAP: Record<
    ProjectNatureCode,
    { label: string; type: 'primary' | 'success' }
  > = {
    design: { label: '设计', type: 'primary' },
    detail: { label: '细化', type: 'success' },
  }

  static readonly GROUP_BY_OPTIONS = [
    { label: '列表', value: '' as ProjectGroupBy },
    { label: '按项目性质', value: 'nature' as ProjectGroupBy },
    { label: '按人员', value: 'personnel' as ProjectGroupBy },
  ] as const

  private static readonly UNASSIGNED_GROUP_KEY = '__unassigned__'
  private static readonly UNSET_NATURE_KEY = '__unset__'

  readonly record: ProjectRecord

  constructor(record: ProjectRecord) {
    this.record = record
  }

  static wrap(record: ProjectRecord) {
    return new ProjectForm(record)
  }

  get projectNo() {
    return this.record.projectNo
  }

  get name() {
    return this.record.name
  }

  get status() {
    return this.record.status
  }

  isActive() {
    return this.record.status === ProjectForm.STATUS.ACTIVE
  }

  isDone() {
    return this.record.status === ProjectForm.STATUS.DONE
  }

  isPaused() {
    return this.record.status === ProjectForm.STATUS.PAUSED
  }

  hasContactForm(contactFormId: string) {
    return this.record.contactFormIds?.includes(contactFormId) ?? false
  }

  static cloneRecord(record: ProjectRecord): ProjectRecord {
    return {
      ...record,
      contactFormIds: [...(record.contactFormIds || [])],
      natures: [...record.natures],
      assignedPersonnelIds: [...record.assignedPersonnelIds],
      assignedPersonnel: record.assignedPersonnel.map((item) => ({ ...item })),
    }
  }

  static cloneSamples(data: ProjectRecord[]) {
    return data.map((item) => ProjectForm.cloneRecord(item))
  }

  static filter(records: ProjectRecord[], { keyword = '', status = '' }: ProjectFilterParams = {}) {
    const normalizedKeyword = keyword.trim().toLowerCase()

    return records.filter((item) => {
      const matchKeyword =
        !normalizedKeyword ||
        item.projectNo.toLowerCase().includes(normalizedKeyword) ||
        item.name.toLowerCase().includes(normalizedKeyword) ||
        item.customer.toLowerCase().includes(normalizedKeyword) ||
        item.assignedPersonnel.some((person) =>
          `${person.name} ${person.team}`.toLowerCase().includes(normalizedKeyword),
        ) ||
        (item.receivedDate || '').toLowerCase().includes(normalizedKeyword) ||
        item.natures.some((nature) =>
          ProjectForm.getNatureLabel(nature).toLowerCase().includes(normalizedKeyword),
        ) ||
        item.contactFormIds?.some((id) => id.toLowerCase().includes(normalizedKeyword))
      const matchStatus = !status || item.status === status
      return matchKeyword && matchStatus
    })
  }

  static filterByNos(records: ProjectRecord[], projectNoList: string[]) {
    const orderMap = new Map(projectNoList.map((no, index) => [no, index]))

    return records
      .filter((item) => orderMap.has(item.projectNo))
      .sort((a, b) => orderMap.get(a.projectNo)! - orderMap.get(b.projectNo)!)
  }

  static groupRecords(
    records: ProjectRecord[],
    groupBy: ProjectGroupBy,
  ): ProjectRecordGroup[] {
    if (!groupBy) return []

    if (groupBy === 'nature') {
      return ProjectForm.groupByMultiKey(
        records,
        (record) =>
          record.natures.length ? record.natures : [ProjectForm.UNSET_NATURE_KEY],
        [
          ProjectForm.NATURE.DESIGN,
          ProjectForm.NATURE.DETAIL,
          ProjectForm.UNSET_NATURE_KEY,
        ],
        (key) => {
          if (key === ProjectForm.UNSET_NATURE_KEY) return '未设置'
          return ProjectForm.getNatureLabel(key as ProjectNatureCode)
        },
      )
    }

    const personnelMap = new Map<string, ProjectAssignee>()
    for (const record of records) {
      for (const person of record.assignedPersonnel) {
        personnelMap.set(person.id, person)
      }
    }

    const orderedPersonnelIds = [...personnelMap.values()]
      .sort((a, b) => {
        const teamCompare = a.team.localeCompare(b.team, 'zh-CN')
        return teamCompare !== 0 ? teamCompare : a.name.localeCompare(b.name, 'zh-CN')
      })
      .map((person) => person.id)

    return ProjectForm.groupByMultiKey(
      records,
      (record) =>
        record.assignedPersonnel.length
          ? record.assignedPersonnel.map((person) => person.id)
          : [ProjectForm.UNASSIGNED_GROUP_KEY],
      [...orderedPersonnelIds, ProjectForm.UNASSIGNED_GROUP_KEY],
      (key) => {
        if (key === ProjectForm.UNASSIGNED_GROUP_KEY) return '未分配'
        const person = personnelMap.get(key)
        return person ? `${person.name} · ${person.team}` : key
      },
    )
  }

  private static groupByMultiKey(
    records: ProjectRecord[],
    getKeys: (record: ProjectRecord) => string[],
    orderedKeys: readonly string[],
    getLabel?: (key: string) => string,
  ): ProjectRecordGroup[] {
    const groups = new Map<string, ProjectRecord[]>()

    for (const record of records) {
      for (const key of getKeys(record)) {
        const members = groups.get(key) ?? []
        members.push(record)
        groups.set(key, members)
      }
    }

    const extraKeys = [...groups.keys()].filter((key) => !orderedKeys.includes(key))
    const keySequence = [...orderedKeys, ...extraKeys]

    return keySequence
      .map((key) => ({
        key,
        label: getLabel?.(key) ?? key,
        members: (groups.get(key) ?? []).sort((a, b) =>
          a.projectNo.localeCompare(b.projectNo, 'zh-CN'),
        ),
      }))
      .filter((group) => group.members.length > 0)
  }

  static getNatureLabel(nature: ProjectNatureCode) {
    return ProjectForm.NATURE_MAP[nature]?.label ?? ''
  }

  static getNatureMeta(nature: ProjectNatureCode) {
    return ProjectForm.NATURE_MAP[nature] ?? null
  }

  static formatCustomerFromPersonnel(assignees: Array<{ name: string }>) {
    return assignees.map((person) => person.name).join('、')
  }

  static normalizeLocalWorkPath(value?: string) {
    return BusinessSystemConfig.normalizeRelativePath(value ?? '')
  }

  static buildLocalWorkPathFull(
    relativePath?: string,
    config = BusinessSystemConfig.LOCAL_WORK_PATH,
  ) {
    return BusinessSystemConfig.buildFullPath(relativePath ?? '', config)
  }

  static hasLocalWorkPath(relativePath?: string) {
    return BusinessSystemConfig.hasLocalWorkPath(relativePath)
  }

  static createEmptyForm(): ProjectFormData {
    return {
      projectNo: '',
      name: '',
      status: ProjectForm.STATUS.ACTIVE,
      natures: [],
      assignedPersonnelIds: [],
      plannedStartDate: new Date().toISOString().slice(0, 10),
      plannedEndDate: '',
      actualStartDate: '',
      actualEndDate: '',
      localWorkPath: '',
    }
  }

  static createFormFromRecord(record: ProjectRecord): ProjectFormData {
    return {
      projectNo: record.projectNo,
      name: record.name,
      status: record.status,
      natures: [...record.natures],
      assignedPersonnelIds: [...record.assignedPersonnelIds],
      plannedStartDate: record.plannedStartDate,
      plannedEndDate: record.plannedEndDate,
      actualStartDate: record.actualStartDate,
      actualEndDate: record.actualEndDate,
      localWorkPath: record.localWorkPath,
    }
  }

  static createFromContact(
    projectNo: string,
    options: {
      contactFormId?: string
      contactTitle?: string
      plannedStartDate?: string
      receivedDate?: string
    } = {},
  ): ProjectRecord {
    const { contactFormId, contactTitle, plannedStartDate, receivedDate } = options
    const orderDate = receivedDate || plannedStartDate || new Date().toISOString().slice(0, 10)

    return {
      projectNo,
      name: contactTitle?.trim() || projectNo,
      contactFormIds: contactFormId ? [contactFormId] : [],
      customer: '',
      status: ProjectForm.STATUS.ACTIVE,
      natures: [],
      assignedPersonnelIds: [],
      assignedPersonnel: [],
      receivedDate: orderDate,
      plannedStartDate: plannedStartDate || orderDate,
      plannedEndDate: '',
      actualStartDate: '',
      actualEndDate: '',
      localWorkPath: '',
    }
  }
}
