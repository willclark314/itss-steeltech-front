import type { FormRules } from 'element-plus'
import { ContactForm } from '@/models/biz/contact'
import type { TagRecord } from '@/models/biz/tag'
import { BusinessSystemConfig } from '../BusinessSystemConfig'
import { DetailWorkflowForm } from './DetailWorkflowForm'
import type { DetailWorkflowRecord } from './DetailWorkflowForm'

export type ProjectStatus = 'active' | 'done' | 'paused' | 'cancelled'
export type ProjectNatureCode =
  | 'design'
  | 'detail'
  | 'detail_issue'
  | 'plate_layout'
  | 'tile_layout'
export type NatureProgressPhase = 'not_started' | 'in_progress' | 'completed'

export interface ProjectAssignee {
  id: string
  name: string
  team: string
}

export interface ProjectContactLink {
  projectNo: string
  contactFormId: string
}

export interface ProjectRecord {
  projectNo: string
  baseProjectNo: string
  name: string
  contactFormIds: string[]
  relatedProjects: ProjectContactLink[]
  isJiagongdan: boolean
  customer: string
  status: ProjectStatus
  designCompleted: boolean
  detailCompleted: boolean
  natures: ProjectNatureCode[]
  tags: TagRecord[]
  assignedPersonnelIds: string[]
  assignedPersonnel: ProjectAssignee[]
  receivedDate: string
  plannedStartDate: string
  plannedEndDate: string
  actualStartDate: string
  actualEndDate: string
  designWorkPath: string
  detailWorkPath: string
  localWorkPath: string
  detailWorkflow?: DetailWorkflowRecord | null
}

export interface ProjectFilterParams {
  keyword?: string
  status?: string
  tags?: string[]
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
  designCompleted: boolean
  detailCompleted: boolean
  natures: ProjectNatureCode[]
  tagIds: string[]
  assignedPersonnelIds: string[]
  plannedStartDate: string
  plannedEndDate: string
  actualStartDate: string
  actualEndDate: string
  designWorkPath: string
  detailWorkPath: string
  localWorkPath: string
}

export class ProjectForm {
  static readonly STATUS = {
    ACTIVE: 'active',
    DONE: 'done',
    PAUSED: 'paused',
    CANCELLED: 'cancelled',
  } as const

  static readonly STATUS_OPTIONS = [
    { label: '全部', value: '' },
    { label: '进行中', value: ProjectForm.STATUS.ACTIVE },
    { label: '已完成', value: ProjectForm.STATUS.DONE },
    { label: '已暂停', value: ProjectForm.STATUS.PAUSED },
    { label: '已取消', value: ProjectForm.STATUS.CANCELLED },
  ]

  static readonly STATUS_FORM_OPTIONS = ProjectForm.STATUS_OPTIONS.filter((item) => item.value)

  static readonly FORM_RULES: FormRules = {
    projectNo: [{ required: true, message: '请输入项目号', trigger: 'blur' }],
    name: [{ required: true, message: '请输入项目名称', trigger: 'blur' }],
  }

  static readonly STATUS_MAP: Record<
    ProjectStatus,
    { label: string; type: 'primary' | 'success' | 'warning' | 'danger' }
  > = {
    active: { label: '进行中', type: 'primary' },
    done: { label: '已完成', type: 'success' },
    paused: { label: '已暂停', type: 'warning' },
    cancelled: { label: '已取消', type: 'danger' },
  }

  static readonly NATURE = {
    DESIGN: 'design',
    DETAIL: 'detail',
    DETAIL_ISSUE: 'detail_issue',
    PLATE_LAYOUT: 'plate_layout',
    TILE_LAYOUT: 'tile_layout',
  } as const

  static readonly NATURE_OPTIONS = [
    { label: '设计', value: ProjectForm.NATURE.DESIGN },
    { label: '细化', value: ProjectForm.NATURE.DETAIL },
    { label: '细化问题', value: ProjectForm.NATURE.DETAIL_ISSUE },
    { label: '排板', value: ProjectForm.NATURE.PLATE_LAYOUT },
    { label: '排瓦', value: ProjectForm.NATURE.TILE_LAYOUT },
  ]

  static readonly NATURE_MAP: Record<
    ProjectNatureCode,
    { label: string; type: 'primary' | 'success' | 'warning' | 'info' }
  > = {
    design: { label: '设计', type: 'primary' },
    detail: { label: '细化', type: 'success' },
    detail_issue: { label: '细化问题', type: 'warning' },
    plate_layout: { label: '排板', type: 'info' },
    tile_layout: { label: '排瓦', type: 'info' },
  }

  static readonly DETAIL_GROUP_NATURES: readonly ProjectNatureCode[] = [
    ProjectForm.NATURE.DETAIL,
    ProjectForm.NATURE.DETAIL_ISSUE,
    ProjectForm.NATURE.PLATE_LAYOUT,
    ProjectForm.NATURE.TILE_LAYOUT,
  ]

  static readonly NATURE_TEAM: Record<ProjectNatureCode, string> = {
    design: '设计组',
    detail: '细化组',
    detail_issue: '细化组',
    plate_layout: '细化组',
    tile_layout: '细化组',
  }

  static readonly NATURE_PROGRESS_LABELS: Record<
    'design' | 'detail',
    Record<NatureProgressPhase, string>
  > = {
    design: { not_started: '未设计', in_progress: '设计中', completed: '设计完' },
    detail: { not_started: '未细化', in_progress: '细化中', completed: '细化完' },
  }

  static readonly NATURE_PROGRESS_TYPE: Record<
    NatureProgressPhase,
    'primary' | 'success' | 'warning' | 'info'
  > = {
    not_started: 'info',
    in_progress: 'primary',
    completed: 'success',
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

  isPaused() {
    return this.record.status === ProjectForm.STATUS.PAUSED
  }

  isCancelled() {
    return this.record.status === ProjectForm.STATUS.CANCELLED
  }

  isTerminal() {
    return this.record.status === ProjectForm.STATUS.DONE || this.isCancelled()
  }

  hasContactForm(contactFormId: string) {
    return this.record.contactFormIds?.includes(contactFormId) ?? false
  }

  static parseBaseProjectNo(projectNo: string): string {
    const normalized = (projectNo || '').trim()
    const sepIndex = normalized.search(/[~#]/)
    if (sepIndex === -1) return normalized
    return normalized.slice(0, sepIndex)
  }

  static getDisplayProjectNo(record: Pick<ProjectRecord, 'projectNo' | 'baseProjectNo'>) {
    const base = (record.baseProjectNo || '').trim()
    if (base) return base
    return ProjectForm.parseBaseProjectNo(record.projectNo)
  }

  static formatDisplayProjectNo(projectNo: string): string {
    return ProjectForm.parseBaseProjectNo(projectNo)
  }

  static getContactLinks(record: ProjectRecord): ProjectContactLink[] {
    return (record.contactFormIds || []).map((contactFormId) => ({
      projectNo: record.projectNo,
      contactFormId: contactFormId.trim(),
    })).filter((link) => link.contactFormId)
  }

  static findRelatedProjectNo(record: ProjectRecord, contactFormId: string): string | undefined {
    const normalizedId = contactFormId.trim()
    if (record.contactFormIds?.includes(normalizedId)) {
      return record.projectNo
    }
    return undefined
  }

  static cloneRecord(record: ProjectRecord): ProjectRecord {
    return {
      ...record,
      baseProjectNo: record.baseProjectNo || record.projectNo,
      contactFormIds: [...(record.contactFormIds || [])],
      relatedProjects: (record.relatedProjects || []).map((item) => ({ ...item })),
      isJiagongdan: Boolean(record.isJiagongdan),
      natures: [...record.natures],
      tags: (record.tags || []).map((item) => ({ ...item })),
      assignedPersonnelIds: [...record.assignedPersonnelIds],
      assignedPersonnel: record.assignedPersonnel.map((item) => ({ ...item })),
      detailWorkflow: record.detailWorkflow ? { ...record.detailWorkflow } : record.detailWorkflow,
    }
  }

  static cloneSamples(data: ProjectRecord[]) {
    return data.map((item) => ProjectForm.cloneRecord(item))
  }

  static sortForDisplay(records: ProjectRecord[]) {
    return [...records].sort((a, b) => {
      const dateA = a.receivedDate || ''
      const dateB = b.receivedDate || ''
      if (dateA !== dateB) return dateB.localeCompare(dateA)
      return b.projectNo.localeCompare(a.projectNo, 'zh-CN')
    })
  }

  static filter(records: ProjectRecord[], { keyword = '', status = '' }: ProjectFilterParams = {}) {
    const normalizedKeyword = keyword.trim().toLowerCase()

    return records.filter((item) => {
      const matchKeyword =
        !normalizedKeyword ||
        item.projectNo.toLowerCase().includes(normalizedKeyword) ||
        ProjectForm.getDisplayProjectNo(item).toLowerCase().includes(normalizedKeyword) ||
        item.name.toLowerCase().includes(normalizedKeyword) ||
        item.customer.toLowerCase().includes(normalizedKeyword) ||
        item.assignedPersonnel.some((person) =>
          `${person.name} ${person.team}`.toLowerCase().includes(normalizedKeyword),
        ) ||
        (item.receivedDate || '').toLowerCase().includes(normalizedKeyword) ||
        item.natures.some((nature) =>
          ProjectForm.getNatureLabel(nature).toLowerCase().includes(normalizedKeyword),
        ) ||
        item.contactFormIds?.some(
          (id) =>
            id.toLowerCase().includes(normalizedKeyword) ||
            ContactForm.formatDisplayId(id, ProjectForm.getDisplayProjectNo(item)).toLowerCase().includes(normalizedKeyword),
        )
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
          ProjectForm.NATURE.DETAIL_ISSUE,
          ProjectForm.NATURE.PLATE_LAYOUT,
          ProjectForm.NATURE.TILE_LAYOUT,
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
        return person ? person.name : key
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
        members: groups.get(key) ?? [],
      }))
      .filter((group) => group.members.length > 0)
  }

  static getNatureLabel(nature: ProjectNatureCode) {
    return ProjectForm.NATURE_MAP[nature]?.label ?? ''
  }

  static getNatureMeta(nature: ProjectNatureCode) {
    return ProjectForm.NATURE_MAP[nature] ?? null
  }

  static isNatureApplicable(record: Pick<ProjectRecord, 'natures'>, nature: ProjectNatureCode) {
    return record.natures.includes(nature)
  }

  static isDetailGroupNature(nature: ProjectNatureCode) {
    return ProjectForm.DETAIL_GROUP_NATURES.includes(nature)
  }

  static hasDetailGroupNature(record: Pick<ProjectRecord, 'natures'>) {
    return record.natures.some((nature) => ProjectForm.isDetailGroupNature(nature))
  }

  static isNatureCompleted(record: Pick<ProjectRecord, 'designCompleted' | 'detailCompleted'>, nature: ProjectNatureCode) {
    if (nature === ProjectForm.NATURE.DESIGN) return record.designCompleted
    if (ProjectForm.isDetailGroupNature(nature)) return record.detailCompleted
    return false
  }

  static isNatureStarted(
    record: Pick<ProjectRecord, 'assignedPersonnel' | 'designWorkPath' | 'detailWorkPath'>,
    nature: ProjectNatureCode,
  ) {
    const team = ProjectForm.NATURE_TEAM[nature]
    const hasTeamAssignee = record.assignedPersonnel.some((person) => person.team === team)
    const workPath =
      nature === ProjectForm.NATURE.DESIGN ? record.designWorkPath : record.detailWorkPath
    return hasTeamAssignee || ProjectForm.hasLocalWorkPath(workPath)
  }

  static isTrackableNature(nature: ProjectNatureCode): nature is 'design' | 'detail' {
    return nature === ProjectForm.NATURE.DESIGN || nature === ProjectForm.NATURE.DETAIL
  }

  static getNatureProgressPhase(
    record: Pick<
      ProjectRecord,
      | 'natures'
      | 'designCompleted'
      | 'detailCompleted'
      | 'assignedPersonnel'
      | 'designWorkPath'
      | 'detailWorkPath'
    >,
    nature: ProjectNatureCode,
  ): NatureProgressPhase | null {
    if (!ProjectForm.isTrackableNature(nature)) return null
    if (!ProjectForm.isNatureApplicable(record, nature)) return null
    if (ProjectForm.isNatureCompleted(record, nature)) return 'completed'
    if (ProjectForm.isNatureStarted(record, nature)) return 'in_progress'
    return 'not_started'
  }

  static getNatureProgressMeta(
    record: Pick<
      ProjectRecord,
      | 'natures'
      | 'designCompleted'
      | 'detailCompleted'
      | 'assignedPersonnel'
      | 'designWorkPath'
      | 'detailWorkPath'
    >,
    nature: ProjectNatureCode,
  ) {
    const phase = ProjectForm.getNatureProgressPhase(record, nature)
    if (phase === null || !ProjectForm.isTrackableNature(nature)) {
      return { label: '不适用', type: 'info' as const }
    }
    return {
      label: ProjectForm.NATURE_PROGRESS_LABELS[nature][phase],
      type: ProjectForm.NATURE_PROGRESS_TYPE[phase],
    }
  }

  static hasDualNatureTasks(record: Pick<ProjectRecord, 'natures'>) {
    return (
      ProjectForm.isNatureApplicable(record, ProjectForm.NATURE.DESIGN) &&
      ProjectForm.isNatureApplicable(record, ProjectForm.NATURE.DETAIL)
    )
  }

  static getFlowStatusItems(
    record: Pick<
      ProjectRecord,
      | 'status'
      | 'natures'
      | 'designCompleted'
      | 'detailCompleted'
      | 'assignedPersonnel'
      | 'designWorkPath'
      | 'detailWorkPath'
      | 'detailWorkflow'
    >,
  ): Array<{ label: string; type: 'primary' | 'success' | 'warning' | 'danger' | 'info' }> {
    const processMeta = ProjectForm.STATUS_MAP[record.status]

    if (ProjectForm.hasDualNatureTasks(record)) {
      const natureItems = [
        ProjectForm.getNatureProgressMeta(record, ProjectForm.NATURE.DESIGN),
        DetailWorkflowForm.getMainPhaseMeta(record),
      ]
      return [{ label: processMeta.label, type: processMeta.type }, ...natureItems]
    }

    if (
      DetailWorkflowForm.needsDetailWorkflow(record.natures) &&
      record.detailWorkflow
    ) {
      const detailMeta = DetailWorkflowForm.getMainPhaseMeta(record)
      return [{ label: processMeta.label, type: processMeta.type }, detailMeta]
    }

    return [{ label: processMeta.label, type: processMeta.type }]
  }

  static formatCustomerFromPersonnel(assignees: Array<{ name: string }>) {
    return assignees.map((person) => person.name).join('、')
  }

  static resolvePrimaryLocalWorkPath(
    record: Pick<ProjectRecord, 'detailWorkPath' | 'designWorkPath' | 'localWorkPath'>,
  ) {
    return (
      ProjectForm.normalizeLocalWorkPath(record.detailWorkPath) ||
      ProjectForm.normalizeLocalWorkPath(record.designWorkPath) ||
      ProjectForm.normalizeLocalWorkPath(record.localWorkPath)
    )
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
      designCompleted: false,
      detailCompleted: false,
      natures: [],
      tagIds: [],
      assignedPersonnelIds: [],
      plannedStartDate: new Date().toISOString().slice(0, 10),
      plannedEndDate: '',
      actualStartDate: '',
      actualEndDate: '',
      designWorkPath: '',
      detailWorkPath: '',
      localWorkPath: '',
    }
  }

  static createFormFromRecord(record: ProjectRecord): ProjectFormData {
    return {
      projectNo: record.projectNo,
      name: record.name,
      status: record.status,
      designCompleted: record.designCompleted,
      detailCompleted: record.detailCompleted,
      natures: [...record.natures],
      tagIds: (record.tags || []).map((item) => item.id),
      assignedPersonnelIds: [...record.assignedPersonnelIds],
      plannedStartDate: record.plannedStartDate,
      plannedEndDate: record.plannedEndDate,
      actualStartDate: record.actualStartDate,
      actualEndDate: record.actualEndDate,
      designWorkPath: record.designWorkPath,
      detailWorkPath: record.detailWorkPath,
      localWorkPath: ProjectForm.resolvePrimaryLocalWorkPath(record),
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
      baseProjectNo: projectNo,
      name: contactTitle?.trim() || projectNo,
      contactFormIds: contactFormId ? [contactFormId] : [],
      relatedProjects: contactFormId
        ? [{ projectNo, contactFormId }]
        : [],
      isJiagongdan: false,
      customer: '',
      status: ProjectForm.STATUS.ACTIVE,
      designCompleted: false,
      detailCompleted: false,
      natures: [],
      tags: [],
      assignedPersonnelIds: [],
      assignedPersonnel: [],
      receivedDate: orderDate,
      plannedStartDate: plannedStartDate || orderDate,
      plannedEndDate: '',
      actualStartDate: '',
      actualEndDate: '',
      designWorkPath: '',
      detailWorkPath: '',
      localWorkPath: '',
    }
  }
}
