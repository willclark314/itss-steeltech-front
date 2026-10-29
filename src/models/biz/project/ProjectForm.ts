import type { FormRules } from 'element-plus'
import { ContactForm } from '@/models/biz/contact'
import type { TagRecord } from '@/models/biz/tag'
import { BusinessSystemConfig } from '../BusinessSystemConfig'
import { DetailWorkflowForm } from './DetailWorkflowForm'
import type { DetailWorkflowRecord } from './DetailWorkflowForm'
import type { DesignWorkflowRecord } from './DesignWorkflowForm'

export type ProjectStatus = 'not_started' | 'active' | 'done' | 'paused' | 'cancelled'
export type ProjectStructureType =
  | '门式钢架'
  | '支架'
  | '管桁架'
  | '钢平台'
  | '框架结构'
  | '型钢桁架'
  | '零星结构'
export type ProjectNatureCode =
  | 'design'
  | 'detail'
  | 'detail_issue'
  | 'plate_layout'
  | 'floor_deck_layout'
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
  /** 任一关联未删除联系单为紧急时为 true（由列表接口随项目数据返回） */
  hasUrgentContact?: boolean
  relatedProjects: ProjectContactLink[]
  isJiagongdan: boolean
  customer: string
  status: ProjectStatus
  designCompleted: boolean
  detailCompleted: boolean
  tileLayoutCompleted: boolean
  floorDeckLayoutCompleted: boolean
  drawingIssueEnabled: boolean
  drawingIssueYearMonth: string
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
  structureType: string
  estimatedWeightTons: number | null
  detailWorkflow?: DetailWorkflowRecord | null
  designWorkflow?: DesignWorkflowRecord | null
}

export interface ProjectFilterParams {
  keyword?: string
  status?: string
  tags?: string[]
}

export interface ProjectFormData {
  projectNo: string
  name: string
  contactFormIds: string[]
  status: ProjectStatus
  designCompleted: boolean
  detailCompleted: boolean
  drawingIssueEnabled: boolean
  drawingIssueYearMonth: string
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
  structureType: string
  estimatedWeightTons: number | null
}

export class ProjectForm {
  static readonly STATUS = {
    NOT_STARTED: 'not_started',
    ACTIVE: 'active',
    DONE: 'done',
    PAUSED: 'paused',
    CANCELLED: 'cancelled',
  } as const

  static readonly STATUS_OPTIONS = [
    { label: '全部', value: '' },
    { label: '未开始', value: ProjectForm.STATUS.NOT_STARTED },
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
    { label: string; type: 'primary' | 'success' | 'warning' | 'danger' | 'info' }
  > = {
    not_started: { label: '未开始', type: 'info' },
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
    FLOOR_DECK_LAYOUT: 'floor_deck_layout',
    TILE_LAYOUT: 'tile_layout',
  } as const

  static readonly NATURE_OPTIONS = [
    { label: '设计', value: ProjectForm.NATURE.DESIGN },
    { label: '细化', value: ProjectForm.NATURE.DETAIL },
    { label: '细化问题', value: ProjectForm.NATURE.DETAIL_ISSUE },
    { label: '排楼板', value: ProjectForm.NATURE.FLOOR_DECK_LAYOUT },
    { label: '排瓦', value: ProjectForm.NATURE.TILE_LAYOUT },
  ]

  static readonly NATURE_MAP: Record<
    ProjectNatureCode,
    { label: string; type: 'primary' | 'success' | 'warning' | 'info' }
  > = {
    design: { label: '设计', type: 'primary' },
    detail: { label: '细化', type: 'success' },
    detail_issue: { label: '细化问题', type: 'warning' },
    plate_layout: { label: '排板（历史）', type: 'info' },
    floor_deck_layout: { label: '排楼板', type: 'info' },
    tile_layout: { label: '排瓦', type: 'info' },
  }

  static readonly DETAIL_GROUP_NATURES: readonly ProjectNatureCode[] = [
    ProjectForm.NATURE.DETAIL,
    ProjectForm.NATURE.DETAIL_ISSUE,
    ProjectForm.NATURE.FLOOR_DECK_LAYOUT,
    ProjectForm.NATURE.TILE_LAYOUT,
  ]

  static readonly NATURE_TEAM: Record<ProjectNatureCode, string> = {
    design: '设计组',
    detail: '细化组',
    detail_issue: '细化组',
    plate_layout: '细化组',
    floor_deck_layout: '细化组',
    tile_layout: '细化组',
  }

  static readonly STRUCTURE_TYPE_OPTIONS: Array<{ label: string; value: ProjectStructureType }> = [
    { label: '门式钢架', value: '门式钢架' },
    { label: '支架', value: '支架' },
    { label: '管桁架', value: '管桁架' },
    { label: '钢平台', value: '钢平台' },
    { label: '框架结构', value: '框架结构' },
    { label: '型钢桁架', value: '型钢桁架' },
    { label: '零星结构', value: '零星结构' },
  ]

  static readonly NATURE_PROGRESS_LABELS: Record<
    'design' | 'detail' | 'tile_layout' | 'floor_deck_layout',
    Record<NatureProgressPhase, string>
  > = {
    design: { not_started: '未设计', in_progress: '设计中', completed: '设计完' },
    detail: { not_started: '未细化', in_progress: '细化中', completed: '细化完' },
    tile_layout: { not_started: '未排瓦', in_progress: '排瓦中', completed: '已排瓦' },
    floor_deck_layout: { not_started: '未排楼板', in_progress: '排楼板中', completed: '已排楼板' },
  }

  static readonly NATURE_PROGRESS_TYPE: Record<
    NatureProgressPhase,
    'primary' | 'success' | 'warning' | 'info'
  > = {
    not_started: 'info',
    in_progress: 'primary',
    completed: 'success',
  }

  static readonly UNASSIGNED_PERSONNEL_FILTER = '__unassigned__'

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

  /**
   * 设计/细化进度是否允许按流程状态编辑。
   * 已取消也允许修改；不要用 isTerminal()（含 cancelled）做拦截。
   */
  static canEditNatureProgressByStatus(_status: ProjectStatus) {
    return true
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

  static hasUrgentContact(record: Pick<ProjectRecord, 'hasUrgentContact'>) {
    return Boolean(record.hasUrgentContact)
  }

  static formatDisplayProjectNo(projectNo: string): string {
    return ProjectForm.parseBaseProjectNo(projectNo)
  }

  /** 点击复制项目号：AB25059 → 25059；26218-1 → 26218-1 */
  static extractProjectNoCopyText(projectNo: string): string {
    const displayNo = ProjectForm.formatDisplayProjectNo(projectNo).trim()
    if (!displayNo) return ''

    const withoutPrefix = displayNo.replace(/^[A-Za-z]+/, '')
    const hyphenMatch = withoutPrefix.match(/^(\d+-\d+)$/)
    if (hyphenMatch) return hyphenMatch[1]

    if (withoutPrefix && /^\d+$/.test(withoutPrefix)) {
      return withoutPrefix
    }

    const digits = withoutPrefix.replace(/\D/g, '')
    return digits || displayNo
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
      designWorkflow: record.designWorkflow ? { ...record.designWorkflow } : record.designWorkflow,
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

  static isNatureCompleted(record: { designCompleted?: boolean; detailCompleted?: boolean; tileLayoutCompleted?: boolean; floorDeckLayoutCompleted?: boolean }, nature: ProjectNatureCode) {
    if (nature === ProjectForm.NATURE.DESIGN) return record.designCompleted ?? false
    if (nature === ProjectForm.NATURE.TILE_LAYOUT) return record.tileLayoutCompleted ?? false
    if (nature === ProjectForm.NATURE.FLOOR_DECK_LAYOUT) return record.floorDeckLayoutCompleted ?? false
    if (ProjectForm.isDetailGroupNature(nature)) return record.detailCompleted ?? false
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

  static isTrackableNature(nature: ProjectNatureCode): nature is 'design' | 'detail' | 'tile_layout' | 'floor_deck_layout' {
    return (
      nature === ProjectForm.NATURE.DESIGN ||
      nature === ProjectForm.NATURE.DETAIL ||
      nature === ProjectForm.NATURE.TILE_LAYOUT ||
      nature === ProjectForm.NATURE.FLOOR_DECK_LAYOUT
    )
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
      | 'tileLayoutCompleted'
      | 'floorDeckLayoutCompleted'
      | 'assignedPersonnel'
      | 'designWorkPath'
      | 'detailWorkPath'
      | 'detailWorkflow'
    >,
  ): Array<{ label: string; type: 'primary' | 'success' | 'warning' | 'danger' | 'info' }> {
    const processMeta = ProjectForm.STATUS_MAP[record.status]
    const items: Array<{ label: string; type: 'primary' | 'success' | 'warning' | 'danger' | 'info' }> = [
      { label: processMeta.label, type: processMeta.type },
    ]

    if (ProjectForm.hasDualNatureTasks(record)) {
      items.push(
        ProjectForm.getNatureProgressMeta(record, ProjectForm.NATURE.DESIGN),
        DetailWorkflowForm.getMainPhaseMeta(record),
      )
    } else if (
      DetailWorkflowForm.needsDetailWorkflow(record.natures) &&
      record.detailWorkflow
    ) {
      items.push(DetailWorkflowForm.getMainPhaseMeta(record))
    } else {
      if (ProjectForm.isNatureApplicable(record, ProjectForm.NATURE.DESIGN)) {
        items.push(ProjectForm.getNatureProgressMeta(record, ProjectForm.NATURE.DESIGN))
      } else if (ProjectForm.hasDetailGroupNature(record)) {
        items.push(ProjectForm.getNatureProgressMeta(record, ProjectForm.NATURE.DETAIL))
      }
    }

    if (ProjectForm.isNatureApplicable(record, ProjectForm.NATURE.TILE_LAYOUT)) {
      items.push(ProjectForm.getNatureProgressMeta(record, ProjectForm.NATURE.TILE_LAYOUT))
    }
    if (ProjectForm.isNatureApplicable(record, ProjectForm.NATURE.FLOOR_DECK_LAYOUT)) {
      items.push(ProjectForm.getNatureProgressMeta(record, ProjectForm.NATURE.FLOOR_DECK_LAYOUT))
    }

    return items
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

  static formatDrawingIssueYearMonth(value?: string) {
    const normalized = (value || '').trim()
    if (!normalized) return '-'
    const [year, month] = normalized.split('-')
    if (!year || !month) return normalized
    return `${year}年${Number(month)}月`
  }

  static formatEstimatedWeightTons(value?: number | null) {
    if (value === null || value === undefined || Number.isNaN(value)) return '-'
    return `${value} t`
  }

  static createEmptyForm(): ProjectFormData {
    return {
      projectNo: '',
      name: '',
      contactFormIds: [],
      status: ProjectForm.STATUS.ACTIVE,
      designCompleted: false,
      detailCompleted: false,
      drawingIssueEnabled: false,
      drawingIssueYearMonth: '',
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
      structureType: '',
      estimatedWeightTons: null,
    }
  }

  static createFormFromRecord(record: ProjectRecord): ProjectFormData {
    return {
      projectNo: record.projectNo,
      name: record.name,
      contactFormIds: [...(record.contactFormIds || [])],
      status: record.status,
      designCompleted: record.designCompleted,
      detailCompleted: record.detailCompleted,
      drawingIssueEnabled: Boolean(record.drawingIssueEnabled),
      drawingIssueYearMonth: record.drawingIssueYearMonth || '',
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
      structureType: record.structureType || '',
      estimatedWeightTons: record.estimatedWeightTons ?? null,
    }
  }

  /** 短横线拆分根号：AB25059-1 → AB25059 */
  static parseRootProjectNo(projectNo: string): string {
    const base = ProjectForm.parseBaseProjectNo(projectNo)
    const match = base.match(/^(.*)-(\d+)$/)
    return match ? match[1] : base
  }

  static hasHyphenSplitSuffix(projectNo: string): boolean {
    const base = ProjectForm.parseBaseProjectNo(projectNo)
    return /-\d+$/.test(base)
  }

  static suggestNextHyphenSplitProjectNo(rootOrNo: string, existingProjectNos: string[]): string {
    const root = ProjectForm.parseRootProjectNo(rootOrNo)
    const existing = new Set(
      existingProjectNos.map((item) => ProjectForm.parseBaseProjectNo(item)),
    )
    let index = 1
    while (existing.has(`${root}-${index}`)) {
      index += 1
    }
    return `${root}-${index}`
  }

  static createFormForCopy(record: ProjectRecord, existingProjectNos: string[]): ProjectFormData {
    const form = ProjectForm.createFormFromRecord(record)
    form.projectNo = ProjectForm.suggestNextHyphenSplitProjectNo(
      record.projectNo,
      existingProjectNos,
    )
    form.actualStartDate = ''
    form.actualEndDate = ''
    return form
  }

  static createFormFromContact(
    projectNo: string,
    options: {
      contactFormId?: string
      contactTitle?: string
      plannedStartDate?: string
      receivedDate?: string
    } = {},
  ): ProjectFormData {
    return ProjectForm.createFormFromRecord(ProjectForm.createFromContact(projectNo, options))
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
      tileLayoutCompleted: false,
      floorDeckLayoutCompleted: false,
      drawingIssueEnabled: false,
      drawingIssueYearMonth: '',
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
      structureType: '',
      estimatedWeightTons: null,
    }
  }

  /** Parse a flow filter value like "process:active" → { kind, value } */
  static parseFlowFilter(filterValue: string): { kind: string; value: string } | null {
    const separatorIndex = filterValue.indexOf(':')
    if (separatorIndex <= 0) return null
    const kind = filterValue.slice(0, separatorIndex)
    const value = filterValue.slice(separatorIndex + 1)
    if (!value) return null
    return { kind, value }
  }

  /** Check whether a record matches a single flow filter value (no team check). */
  static matchesFlowFilter(
    record: Pick<
      ProjectRecord,
      'status' | 'natures' | 'designCompleted' | 'detailCompleted'
      | 'tileLayoutCompleted' | 'floorDeckLayoutCompleted'
      | 'assignedPersonnel' | 'designWorkPath' | 'detailWorkPath' | 'detailWorkflow'
    >,
    filterValue: string,
  ): boolean {
    const parsed = ProjectForm.parseFlowFilter(filterValue)
    if (!parsed) return false

    if (parsed.kind === 'process') {
      return record.status === parsed.value
    }

    if (parsed.kind === 'design') {
      const phase = ProjectForm.getNatureProgressPhase(record, ProjectForm.NATURE.DESIGN)
      return phase === parsed.value
    }

    if (parsed.kind === 'detail') {
      const usesWorkflow =
        DetailWorkflowForm.needsDetailWorkflow(record.natures) && Boolean(record.detailWorkflow)
      if (usesWorkflow) return false
      const phase = ProjectForm.getNatureProgressPhase(record, ProjectForm.NATURE.DETAIL)
      return phase === parsed.value
    }

    if (parsed.kind === 'detailMain') {
      if (
        !DetailWorkflowForm.needsDetailWorkflow(record.natures) ||
        !record.detailWorkflow
      ) {
        return false
      }
      const hasPlateLayout = DetailWorkflowForm.hasPlateLayoutPhase(record.detailWorkflow)
      const phase = DetailWorkflowForm.deriveMainPhase(record.detailWorkflow, hasPlateLayout)
      return phase === parsed.value
    }

    if (parsed.kind === 'tile') {
      if (!ProjectForm.isNatureApplicable(record, ProjectForm.NATURE.TILE_LAYOUT)) return false
      const phase = ProjectForm.getNatureProgressPhase(record, ProjectForm.NATURE.TILE_LAYOUT)
      return phase === parsed.value
    }

    if (parsed.kind === 'floorDeck') {
      if (!ProjectForm.isNatureApplicable(record, ProjectForm.NATURE.FLOOR_DECK_LAYOUT)) return false
      const phase = ProjectForm.getNatureProgressPhase(record, ProjectForm.NATURE.FLOOR_DECK_LAYOUT)
      return phase === parsed.value
    }

    return false
  }

  /** Check whether a record matches any of the given flow filter values (OR logic). */
  static matchesFlowFilters(
    record: Parameters<typeof ProjectForm.matchesFlowFilter>[0],
    filterValues: readonly string[],
  ): boolean {
    if (!filterValues.length) return true
    return filterValues.some((fv) => ProjectForm.matchesFlowFilter(record, fv))
  }

  /** Check whether a record has all of the given nature codes (AND logic). */
  static matchesNatureFilters(
    record: Pick<ProjectRecord, 'natures'>,
    natureFilters: readonly string[],
  ): boolean {
    if (!natureFilters.length) return true
    return natureFilters.every((nf) => record.natures.includes(nf as ProjectNatureCode))
  }

  /** Check whether a record is assigned to the given personnel (empty id = no filter). */
  static matchesAssignedPersonnelFilter(
    record: Pick<ProjectRecord, 'assignedPersonnelIds'>,
    personnelId: string,
  ): boolean {
    if (!personnelId) return true
    if (personnelId === ProjectForm.UNASSIGNED_PERSONNEL_FILTER) {
      return record.assignedPersonnelIds.length === 0
    }
    return record.assignedPersonnelIds.includes(personnelId)
  }
}
