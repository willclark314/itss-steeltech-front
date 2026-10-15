import type { ProjectRecord } from '@/models/biz/project'
import { DetailWorkflowForm } from '@/models/biz/project/DetailWorkflowForm'
import { ProjectForm } from '@/models/biz/project/ProjectForm'
import { ProjectWorkPath } from '@/models/biz/ProjectWorkPath'
import { MyCalendarForm } from '@/models/portal/MyCalendarForm'

/** 单条钢构细化发图计划记录（细化/排楼承板独立发图时间） */
export interface DrawingIssuePlanRecord {
  id: string
  year: number
  month: number
  seq: number
  projectName: string
  projectNo: string
  componentWeightKg: number | null
  materialPrepListIssueDate: string | null
  detailPlannedIssueDate: string | null
  detailActualIssueDate: string | null
  floorDeckPlannedIssueDate: string | null
  floorDeckActualIssueDate: string | null
  remark: string
}

/** 发图计划行展示状态（互斥，同一行只会命中其一） */
export type DrawingIssueRowState = 'issued' | 'unissued' | 'approaching' | 'overdue'

/** @deprecated 使用 DrawingIssueRowState */
export type DrawingIssueStatus = DrawingIssueRowState | 'normal' | 'pending'

export interface DrawingIssueRowMeta {
  state: DrawingIssueRowState
  label: string
  rowClass: string
  plannedDateClass: string
  actualDateClass: string
}

/** @deprecated 使用 DrawingIssueRowMeta */
export type DrawingIssueStatusMeta = DrawingIssueRowMeta & {
  status?: DrawingIssueRowState
  dateClass?: string
}

const DRAWING_ISSUE_ROW_STATE_META: Record<
  DrawingIssueRowState,
  Pick<DrawingIssueRowMeta, 'label' | 'rowClass' | 'plannedDateClass'>
> = {
  issued: {
    label: '',
    rowClass: '',
    plannedDateClass: '',
  },
  unissued: {
    label: '',
    rowClass: 'is-row-unissued',
    plannedDateClass: '',
  },
  approaching: {
    label: '临近未发',
    rowClass: 'is-row-approaching',
    plannedDateClass: 'is-date-approaching',
  },
  overdue: {
    label: '发出超时',
    rowClass: 'is-row-overdue',
    plannedDateClass: 'is-date-overdue',
  },
}

const STATE_PRIORITY: Record<DrawingIssueRowState, number> = {
  overdue: 4,
  approaching: 3,
  unissued: 2,
  issued: 1,
}

/** 发图状态展示选项 */
export interface DrawingIssuePlanDisplayOptions {
  approachingDays?: number
}

/** 发图计划行编辑表单 */
export interface DrawingIssuePlanEditForm {
  projectNo: string
  componentWeightKg: number | null
  materialPrepListIssueDate: string
  detailPlannedIssueDate: string
  detailActualIssueDate: string
  floorDeckPlannedIssueDate: string
  floorDeckActualIssueDate: string
  remark: string
}

/** 关联项目后的表格行 */
export interface DrawingIssuePlanRow extends DrawingIssuePlanRecord {
  linkedProject?: ProjectRecord | null
}

export class DrawingIssuePlanForm {
  /** 每月该日之后默认展示下一月发图计划（如 7.23~8.22 → 8月） */
  static readonly PLAN_MONTH_ROLLOVER_DAY = 22

  /** 细化发图计划可选：细化 / 排楼承板（细化仅此页） */
  static readonly ELIGIBLE_NATURES = [
    ProjectForm.NATURE.DETAIL,
    ProjectForm.NATURE.DETAIL_ISSUE,
    ProjectForm.NATURE.FLOOR_DECK_LAYOUT,
  ] as const

  static isEligibleProject(project: Pick<ProjectRecord, 'natures'>): boolean {
    return DrawingIssuePlanForm.ELIGIBLE_NATURES.some((nature) =>
      project.natures.includes(nature),
    )
  }

  /** 按业务周期计算默认展示的发图计划年月 */
  static getDefaultPlanPeriod(today = new Date()) {
    const year = today.getFullYear()
    const month = today.getMonth() + 1
    if (today.getDate() > DrawingIssuePlanForm.PLAN_MONTH_ROLLOVER_DAY) {
      return MyCalendarForm.shiftMonth(year, month, 1)
    }
    return { year, month }
  }

  static getCurrentYear(): number {
    return DrawingIssuePlanForm.getDefaultPlanPeriod().year
  }

  static getCurrentMonth(): number {
    return DrawingIssuePlanForm.getDefaultPlanPeriod().month
  }

  static buildTitle(year: number, month: number): string {
    return `设备技术部${year}年${month}月钢构细化发图计划`
  }

  static shiftMonth(year: number, month: number, delta: number) {
    return MyCalendarForm.shiftMonth(year, month, delta)
  }

  static formatMonthLabel(year: number, month: number) {
    return MyCalendarForm.formatMonthLabel(year, month)
  }

  static readonly KG_PER_TON = 1000

  static kgToTons(kg: number | null | undefined): number | null {
    if (kg == null || Number.isNaN(kg)) return null
    return kg / DrawingIssuePlanForm.KG_PER_TON
  }

  static tonsToKg(tons: number | null | undefined): number | null {
    if (tons == null || Number.isNaN(tons)) return null
    return Math.round(tons * DrawingIssuePlanForm.KG_PER_TON)
  }

  /** @deprecated 构件重量已改为吨，请使用 formatComponentWeightTons */
  static formatWeight(value: number | null | undefined): string {
    return DrawingIssuePlanForm.formatComponentWeightTons(value)
  }

  static formatComponentWeightTons(valueKg: number | null | undefined): string {
    const tons = DrawingIssuePlanForm.kgToTons(valueKg)
    if (tons == null) return '-'
    return tons.toLocaleString('zh-CN', { maximumFractionDigits: 3 })
  }

  static formatTotalWeightTons(totalKg: number): string {
    return (totalKg / DrawingIssuePlanForm.KG_PER_TON).toLocaleString('zh-CN', {
      maximumFractionDigits: 3,
    })
  }

  static formatDate(value: string | null | undefined): string {
    if (!value) return '-'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return value
    const month = date.getMonth() + 1
    const day = date.getDate()
    return `${month}月${day}日`
  }

  static parseDate(value: string | null | undefined): Date | null {
    if (!value) return null
    const parts = value.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
    if (!parts) return null
    const date = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]))
    return Number.isNaN(date.getTime()) ? null : date
  }

  static startOfDay(date: Date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate())
  }

  static diffDays(from: Date, to: Date) {
    const ms = DrawingIssuePlanForm.startOfDay(to).getTime() - DrawingIssuePlanForm.startOfDay(from).getTime()
    return Math.round(ms / 86400000)
  }

  static resolveDatePairState(
    plannedIssueDate: string | null | undefined,
    actualIssueDate: string | null | undefined,
    today = new Date(),
    options: DrawingIssuePlanDisplayOptions = {},
  ): DrawingIssueRowState {
    const actual = DrawingIssuePlanForm.parseDate(actualIssueDate)
    const planned = DrawingIssuePlanForm.parseDate(plannedIssueDate)

    if (actual) {
      return planned && actual.getTime() > planned.getTime() ? 'overdue' : 'issued'
    }

    if (!planned) return 'unissued'

    const now = DrawingIssuePlanForm.startOfDay(today)
    const approachingDays = Math.max(0, Math.round(options.approachingDays ?? 0))
    const daysUntilPlanned = DrawingIssuePlanForm.diffDays(now, planned)

    if (daysUntilPlanned < 0) return 'overdue'
    if (daysUntilPlanned <= approachingDays) return 'approaching'
    return 'unissued'
  }

  static getDatePairMeta(
    plannedIssueDate: string | null | undefined,
    actualIssueDate: string | null | undefined,
    today = new Date(),
    options: DrawingIssuePlanDisplayOptions = {},
  ): DrawingIssueRowMeta {
    const state = DrawingIssuePlanForm.resolveDatePairState(
      plannedIssueDate,
      actualIssueDate,
      today,
      options,
    )
    const preset = DRAWING_ISSUE_ROW_STATE_META[state]
    const actual = DrawingIssuePlanForm.parseDate(actualIssueDate)
    return {
      state,
      label: preset.label,
      rowClass: preset.rowClass,
      plannedDateClass: preset.plannedDateClass,
      actualDateClass: state === 'overdue' && actual ? 'is-date-overdue' : '',
    }
  }

  static resolveRowState(
    row: Pick<
      DrawingIssuePlanRecord,
      | 'detailPlannedIssueDate'
      | 'detailActualIssueDate'
      | 'floorDeckPlannedIssueDate'
      | 'floorDeckActualIssueDate'
    >,
    today = new Date(),
    options: DrawingIssuePlanDisplayOptions = {},
  ): DrawingIssueRowState {
    const pairs = [
      { planned: row.detailPlannedIssueDate, actual: row.detailActualIssueDate },
      { planned: row.floorDeckPlannedIssueDate, actual: row.floorDeckActualIssueDate },
    ].filter((pair) => pair.planned || pair.actual)

    if (!pairs.length) return 'unissued'

    let worst: DrawingIssueRowState = 'issued'
    for (const pair of pairs) {
      const state = DrawingIssuePlanForm.resolveDatePairState(
        pair.planned,
        pair.actual,
        today,
        options,
      )
      if (STATE_PRIORITY[state] > STATE_PRIORITY[worst]) {
        worst = state
      }
    }
    return worst
  }

  /** @deprecated 使用 resolveRowState */
  static resolveIssueStatus(
    row: Parameters<typeof DrawingIssuePlanForm.resolveRowState>[0],
    today = new Date(),
    options: DrawingIssuePlanDisplayOptions = {},
  ): DrawingIssueRowState {
    return DrawingIssuePlanForm.resolveRowState(row, today, options)
  }

  static getRowStateMeta(
    row: Parameters<typeof DrawingIssuePlanForm.resolveRowState>[0],
    today = new Date(),
    options: DrawingIssuePlanDisplayOptions = {},
  ): DrawingIssueRowMeta {
    const state = DrawingIssuePlanForm.resolveRowState(row, today, options)
    const preset = DRAWING_ISSUE_ROW_STATE_META[state]
    return {
      state,
      label: preset.label,
      rowClass: preset.rowClass,
      plannedDateClass: preset.plannedDateClass,
      actualDateClass: state === 'overdue' ? 'is-date-overdue' : '',
    }
  }

  /** @deprecated 使用 getRowStateMeta */
  static getIssueStatusMeta(
    row: Parameters<typeof DrawingIssuePlanForm.resolveRowState>[0],
    today = new Date(),
    options: DrawingIssuePlanDisplayOptions = {},
  ): DrawingIssueRowMeta {
    return DrawingIssuePlanForm.getRowStateMeta(row, today, options)
  }

  static sumWeight(records: Array<Pick<DrawingIssuePlanRecord, 'componentWeightKg'>>): number {
    return records.reduce((sum, item) => sum + (item.componentWeightKg ?? 0), 0)
  }

  static buildProjectMap(projects: ProjectRecord[]): Map<string, ProjectRecord> {
    const map = new Map<string, ProjectRecord>()
    for (const project of projects) {
      for (const key of DrawingIssuePlanForm.collectProjectLookupKeys(project)) {
        if (!map.has(key)) {
          map.set(key, project)
        }
      }
    }
    return map
  }

  static collectProjectLookupKeys(project: ProjectRecord): string[] {
    const keys = new Set<string>()
    const projectNo = project.projectNo.trim()
    if (!projectNo) return []

    keys.add(projectNo.toUpperCase())
    keys.add(ProjectForm.getDisplayProjectNo(project).toUpperCase())
    keys.add(ProjectForm.parseBaseProjectNo(projectNo).toUpperCase())

    const withoutPrefix = projectNo.replace(/^[A-Za-z]+/, '')
    if (withoutPrefix) {
      keys.add(withoutPrefix.toUpperCase())
    }

    const digits = ProjectWorkPath.extractProjectNoDigits(projectNo)
    if (digits) {
      keys.add(digits)
    }

    return [...keys]
  }

  static resolveLinkedProject(
    projectNo: string,
    projectMap: Map<string, ProjectRecord>,
  ): ProjectRecord | null {
    const trimmed = projectNo.trim()
    if (!trimmed) return null

    const lookupKeys = [
      trimmed.toUpperCase(),
      ProjectForm.formatDisplayProjectNo(trimmed).toUpperCase(),
      ProjectForm.parseBaseProjectNo(trimmed).toUpperCase(),
      trimmed.replace(/^[A-Za-z]+/, '').toUpperCase(),
      ProjectWorkPath.extractProjectNoDigits(trimmed),
    ]

    for (const key of lookupKeys) {
      if (!key) continue
      const hit = projectMap.get(key)
      if (hit) return hit
    }

    return null
  }

  static isProjectLinked(
    row: Pick<DrawingIssuePlanRecord, 'projectNo'>,
    projectMap: Map<string, ProjectRecord>,
  ): boolean {
    return DrawingIssuePlanForm.resolveLinkedProject(row.projectNo, projectMap) != null
  }

  static resolveComponentWeightFromProject(project: ProjectRecord | null | undefined): number | null {
    const tons = project?.detailWorkflow?.modelWeightTons
    if (tons == null || Number.isNaN(tons)) return null
    return Math.round(tons * 1000)
  }

  static resolveProjectName(
    row: Pick<DrawingIssuePlanRecord, 'projectName' | 'projectNo'>,
    project?: ProjectRecord | null,
  ): string {
    return project?.name?.trim() || row.projectName.trim()
  }

  static enrichRows(
    records: DrawingIssuePlanRecord[],
    projectMap: Map<string, ProjectRecord>,
  ): DrawingIssuePlanRow[] {
    return records.map((record) => {
      const linkedProject = DrawingIssuePlanForm.resolveLinkedProject(record.projectNo, projectMap)
      return {
        ...record,
        projectName: DrawingIssuePlanForm.resolveProjectName(record, linkedProject),
        linkedProject,
      }
    })
  }

  static collectProjectNos(records: Array<Pick<DrawingIssuePlanRecord, 'projectNo'>>): Set<string> {
    return new Set(
      records
        .map((item) => item.projectNo.trim().toUpperCase())
        .filter(Boolean),
    )
  }

  static buildRowFromProject(
    project: ProjectRecord,
    year: number,
    month: number,
    seq: number,
  ): DrawingIssuePlanRow {
    const defaultDate = project.plannedEndDate || null
    const hasDetail =
      project.natures.includes(ProjectForm.NATURE.DETAIL) ||
      project.natures.includes(ProjectForm.NATURE.DETAIL_ISSUE)
    return {
      id: `${year}_${String(month).padStart(2, '0')}_${String(seq).padStart(3, '0')}`,
      year,
      month,
      seq,
      projectNo: project.projectNo,
      projectName: project.name,
      componentWeightKg: DrawingIssuePlanForm.resolveComponentWeightFromProject(project),
      materialPrepListIssueDate: null,
      detailPlannedIssueDate: hasDetail ? defaultDate : null,
      detailActualIssueDate: null,
      // 排楼承板与设计页共享：新建时留空，保存时由后端从对端继承
      floorDeckPlannedIssueDate: null,
      floorDeckActualIssueDate: null,
      remark: '',
      linkedProject: project,
    }
  }

  static appendProjects(
    records: DrawingIssuePlanRow[],
    projects: ProjectRecord[],
    year: number,
    month: number,
  ): DrawingIssuePlanRow[] {
    const existing = DrawingIssuePlanForm.collectProjectNos(records)
    const next = [...records]
    let seq = records.length

    for (const project of ProjectForm.sortForDisplay(projects)) {
      const projectNo = project.projectNo.trim().toUpperCase()
      if (!projectNo || existing.has(projectNo)) continue
      seq += 1
      next.push(DrawingIssuePlanForm.buildRowFromProject(project, year, month, seq))
      existing.add(projectNo)
    }

    return DrawingIssuePlanForm.normalizeRows(next, year, month)
  }

  static normalizeRows(
    records: DrawingIssuePlanRow[],
    year: number,
    month: number,
  ): DrawingIssuePlanRow[] {
    return records
      .map((item, index) => ({
        ...item,
        year,
        month,
        seq: index + 1,
        id: `${year}_${String(month).padStart(2, '0')}_${String(index + 1).padStart(3, '0')}`,
      }))
      .filter((item) => item.projectName.trim() || item.projectNo.trim())
  }

  static buildSavePayload(
    rows: DrawingIssuePlanRow[],
    year: number,
    month: number,
  ): DrawingIssuePlanRecord[] {
    return DrawingIssuePlanForm.normalizeRows(rows, year, month).map(
      ({ linkedProject: _linkedProject, ...record }) => ({
        ...record,
        projectName: record.projectName.trim(),
        projectNo: record.projectNo.trim(),
        remark: record.remark || '',
      }),
    )
  }

  static getModelWeightDisplay(project: ProjectRecord | null | undefined): string {
    if (!project || !DetailWorkflowForm.needsDetailWorkflow(project.natures)) return '-'
    return DetailWorkflowForm.formatModelWeightDisplay(project.detailWorkflow?.modelWeightTons)
  }

  static createEditForm(row: DrawingIssuePlanRow): DrawingIssuePlanEditForm {
    return {
      projectNo: row.projectNo,
      componentWeightKg: row.componentWeightKg,
      materialPrepListIssueDate: row.materialPrepListIssueDate || '',
      detailPlannedIssueDate: row.detailPlannedIssueDate || '',
      detailActualIssueDate: row.detailActualIssueDate || '',
      floorDeckPlannedIssueDate: row.floorDeckPlannedIssueDate || '',
      floorDeckActualIssueDate: row.floorDeckActualIssueDate || '',
      remark: row.remark || '',
    }
  }

  static applyEditForm(
    row: DrawingIssuePlanRow,
    form: DrawingIssuePlanEditForm,
    projectMap?: Map<string, ProjectRecord>,
  ): DrawingIssuePlanRow {
    const linkedProject = projectMap
      ? DrawingIssuePlanForm.resolveLinkedProject(form.projectNo, projectMap)
      : null
    const projectNo = linkedProject?.projectNo ?? form.projectNo.trim()

    return {
      ...row,
      projectNo,
      projectName: DrawingIssuePlanForm.resolveProjectName(
        { projectName: row.projectName, projectNo },
        linkedProject,
      ),
      linkedProject,
      componentWeightKg: form.componentWeightKg,
      materialPrepListIssueDate: form.materialPrepListIssueDate || null,
      detailPlannedIssueDate: form.detailPlannedIssueDate || null,
      detailActualIssueDate: form.detailActualIssueDate || null,
      floorDeckPlannedIssueDate: form.floorDeckPlannedIssueDate || null,
      floorDeckActualIssueDate: form.floorDeckActualIssueDate || null,
      remark: form.remark.trim(),
    }
  }
}
