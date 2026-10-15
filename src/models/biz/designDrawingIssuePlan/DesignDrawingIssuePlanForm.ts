import type { ProjectRecord } from '@/models/biz/project'
import { DesignWorkflowForm } from '@/models/biz/project/DesignWorkflowForm'
import { ProjectForm } from '@/models/biz/project/ProjectForm'
import { ProjectWorkPath } from '@/models/biz/ProjectWorkPath'
import { MyCalendarForm } from '@/models/portal/MyCalendarForm'

/** 单条钢构设计发图计划记录（设计/排瓦/排楼承板独立发图时间） */
export interface DesignDrawingIssuePlanRecord {
  id: string
  year: number
  month: number
  seq: number
  projectName: string
  projectNo: string
  designPlannedIssueDate: string | null
  designActualIssueDate: string | null
  tileLayoutPlannedIssueDate: string | null
  tileLayoutActualIssueDate: string | null
  floorDeckPlannedIssueDate: string | null
  floorDeckActualIssueDate: string | null
  remark: string
}

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

export interface DesignDrawingIssuePlanDisplayOptions {
  approachingDays?: number
}

export interface DesignDrawingIssuePlanEditForm {
  projectNo: string
  designPlannedIssueDate: string
  designActualIssueDate: string
  tileLayoutPlannedIssueDate: string
  tileLayoutActualIssueDate: string
  floorDeckPlannedIssueDate: string
  floorDeckActualIssueDate: string
  remark: string
}

export interface DesignDrawingIssuePlanRow extends DesignDrawingIssuePlanRecord {
  linkedProject?: ProjectRecord | null
}

export class DesignDrawingIssuePlanForm {
  static readonly PLAN_MONTH_ROLLOVER_DAY = 22

  static readonly ELIGIBLE_NATURES = [
    ProjectForm.NATURE.DESIGN,
    ProjectForm.NATURE.TILE_LAYOUT,
    ProjectForm.NATURE.FLOOR_DECK_LAYOUT,
  ] as const

  static getDefaultPlanPeriod(today = new Date()) {
    const year = today.getFullYear()
    const month = today.getMonth() + 1
    if (today.getDate() > DesignDrawingIssuePlanForm.PLAN_MONTH_ROLLOVER_DAY) {
      return MyCalendarForm.shiftMonth(year, month, 1)
    }
    return { year, month }
  }

  static getCurrentYear(): number {
    return DesignDrawingIssuePlanForm.getDefaultPlanPeriod().year
  }

  static getCurrentMonth(): number {
    return DesignDrawingIssuePlanForm.getDefaultPlanPeriod().month
  }

  static buildTitle(year: number, month: number): string {
    return `设备技术部${year}年${month}月钢构设计发图计划`
  }

  static shiftMonth(year: number, month: number, delta: number) {
    return MyCalendarForm.shiftMonth(year, month, delta)
  }

  static formatMonthLabel(year: number, month: number) {
    return MyCalendarForm.formatMonthLabel(year, month)
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
    const ms =
      DesignDrawingIssuePlanForm.startOfDay(to).getTime() -
      DesignDrawingIssuePlanForm.startOfDay(from).getTime()
    return Math.round(ms / 86400000)
  }

  static resolveDatePairState(
    plannedIssueDate: string | null | undefined,
    actualIssueDate: string | null | undefined,
    today = new Date(),
    options: DesignDrawingIssuePlanDisplayOptions = {},
  ): DrawingIssueRowState {
    const actual = DesignDrawingIssuePlanForm.parseDate(actualIssueDate)
    const planned = DesignDrawingIssuePlanForm.parseDate(plannedIssueDate)

    if (actual) {
      return planned && actual.getTime() > planned.getTime() ? 'overdue' : 'issued'
    }
    if (!planned) return 'unissued'

    const now = DesignDrawingIssuePlanForm.startOfDay(today)
    const approachingDays = Math.max(0, Math.round(options.approachingDays ?? 0))
    const daysUntilPlanned = DesignDrawingIssuePlanForm.diffDays(now, planned)
    if (daysUntilPlanned < 0) return 'overdue'
    if (daysUntilPlanned <= approachingDays) return 'approaching'
    return 'unissued'
  }

  static getDatePairMeta(
    plannedIssueDate: string | null | undefined,
    actualIssueDate: string | null | undefined,
    today = new Date(),
    options: DesignDrawingIssuePlanDisplayOptions = {},
  ): DrawingIssueRowMeta {
    const state = DesignDrawingIssuePlanForm.resolveDatePairState(
      plannedIssueDate,
      actualIssueDate,
      today,
      options,
    )
    const preset = DRAWING_ISSUE_ROW_STATE_META[state]
    const actual = DesignDrawingIssuePlanForm.parseDate(actualIssueDate)
    return {
      state,
      label: preset.label,
      rowClass: preset.rowClass,
      plannedDateClass: preset.plannedDateClass,
      actualDateClass: state === 'overdue' && actual ? 'is-date-overdue' : '',
    }
  }

  static collectIssueDatePairs(
    row: Pick<
      DesignDrawingIssuePlanRecord,
      | 'designPlannedIssueDate'
      | 'designActualIssueDate'
      | 'tileLayoutPlannedIssueDate'
      | 'tileLayoutActualIssueDate'
      | 'floorDeckPlannedIssueDate'
      | 'floorDeckActualIssueDate'
    >,
  ) {
    return [
      { planned: row.designPlannedIssueDate, actual: row.designActualIssueDate },
      { planned: row.tileLayoutPlannedIssueDate, actual: row.tileLayoutActualIssueDate },
      { planned: row.floorDeckPlannedIssueDate, actual: row.floorDeckActualIssueDate },
    ]
  }

  static resolveRowState(
    row: Pick<
      DesignDrawingIssuePlanRecord,
      | 'designPlannedIssueDate'
      | 'designActualIssueDate'
      | 'tileLayoutPlannedIssueDate'
      | 'tileLayoutActualIssueDate'
      | 'floorDeckPlannedIssueDate'
      | 'floorDeckActualIssueDate'
    >,
    today = new Date(),
    options: DesignDrawingIssuePlanDisplayOptions = {},
  ): DrawingIssueRowState {
    const pairs = DesignDrawingIssuePlanForm.collectIssueDatePairs(row).filter(
      (pair) => pair.planned || pair.actual,
    )
    if (!pairs.length) return 'unissued'

    let worst: DrawingIssueRowState = 'issued'
    for (const pair of pairs) {
      const state = DesignDrawingIssuePlanForm.resolveDatePairState(
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
    row: Parameters<typeof DesignDrawingIssuePlanForm.resolveRowState>[0],
    today = new Date(),
    options: DesignDrawingIssuePlanDisplayOptions = {},
  ): DrawingIssueRowState {
    return DesignDrawingIssuePlanForm.resolveRowState(row, today, options)
  }

  static getRowStateMeta(
    row: Parameters<typeof DesignDrawingIssuePlanForm.resolveRowState>[0],
    today = new Date(),
    options: DesignDrawingIssuePlanDisplayOptions = {},
  ): DrawingIssueRowMeta {
    const state = DesignDrawingIssuePlanForm.resolveRowState(row, today, options)
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
    row: Parameters<typeof DesignDrawingIssuePlanForm.resolveRowState>[0],
    today = new Date(),
    options: DesignDrawingIssuePlanDisplayOptions = {},
  ): DrawingIssueRowMeta {
    return DesignDrawingIssuePlanForm.getRowStateMeta(row, today, options)
  }

  static buildProjectMap(projects: ProjectRecord[]): Map<string, ProjectRecord> {
    const map = new Map<string, ProjectRecord>()
    for (const project of projects) {
      for (const key of DesignDrawingIssuePlanForm.collectProjectLookupKeys(project)) {
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
    row: Pick<DesignDrawingIssuePlanRecord, 'projectNo'>,
    projectMap: Map<string, ProjectRecord>,
  ): boolean {
    return DesignDrawingIssuePlanForm.resolveLinkedProject(row.projectNo, projectMap) != null
  }

  static isEligibleProject(project: Pick<ProjectRecord, 'natures'>): boolean {
    return DesignDrawingIssuePlanForm.ELIGIBLE_NATURES.some((nature) =>
      project.natures.includes(nature),
    )
  }

  static resolveComponentWeightFromProject(_project: ProjectRecord | null | undefined): number | null {
    return null
  }

  static resolveProjectName(
    row: Pick<DesignDrawingIssuePlanRecord, 'projectName' | 'projectNo'>,
    project?: ProjectRecord | null,
  ): string {
    return project?.name?.trim() || row.projectName.trim()
  }

  static enrichRows(
    records: DesignDrawingIssuePlanRecord[],
    projectMap: Map<string, ProjectRecord>,
  ): DesignDrawingIssuePlanRow[] {
    return records.map((record) => {
      const linkedProject = DesignDrawingIssuePlanForm.resolveLinkedProject(record.projectNo, projectMap)
      return {
        ...record,
        projectName: DesignDrawingIssuePlanForm.resolveProjectName(record, linkedProject),
        linkedProject,
      }
    })
  }

  static collectProjectNos(records: Array<Pick<DesignDrawingIssuePlanRecord, 'projectNo'>>): Set<string> {
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
  ): DesignDrawingIssuePlanRow {
    const defaultDate = project.plannedEndDate || null
    return {
      id: `${year}_${String(month).padStart(2, '0')}_${String(seq).padStart(3, '0')}`,
      year,
      month,
      seq,
      projectNo: project.projectNo,
      projectName: project.name,
      designPlannedIssueDate: project.natures.includes(ProjectForm.NATURE.DESIGN) ? defaultDate : null,
      designActualIssueDate: null,
      tileLayoutPlannedIssueDate: project.natures.includes(ProjectForm.NATURE.TILE_LAYOUT)
        ? defaultDate
        : null,
      tileLayoutActualIssueDate: null,
      // 排楼承板与细化页共享：新建时留空，保存时由后端从对端继承
      floorDeckPlannedIssueDate: null,
      floorDeckActualIssueDate: null,
      remark: '',
      linkedProject: project,
    }
  }

  static appendProjects(
    records: DesignDrawingIssuePlanRow[],
    projects: ProjectRecord[],
    year: number,
    month: number,
  ): DesignDrawingIssuePlanRow[] {
    const existing = DesignDrawingIssuePlanForm.collectProjectNos(records)
    const next = [...records]
    let seq = records.length

    for (const project of ProjectForm.sortForDisplay(projects)) {
      const projectNo = project.projectNo.trim().toUpperCase()
      if (!projectNo || existing.has(projectNo)) continue
      seq += 1
      next.push(DesignDrawingIssuePlanForm.buildRowFromProject(project, year, month, seq))
      existing.add(projectNo)
    }

    return DesignDrawingIssuePlanForm.normalizeRows(next, year, month)
  }

  static normalizeRows(
    records: DesignDrawingIssuePlanRow[],
    year: number,
    month: number,
  ): DesignDrawingIssuePlanRow[] {
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
    rows: DesignDrawingIssuePlanRow[],
    year: number,
    month: number,
  ): DesignDrawingIssuePlanRecord[] {
    return DesignDrawingIssuePlanForm.normalizeRows(rows, year, month).map(
      ({ linkedProject: _linkedProject, ...record }) => ({
        ...record,
        projectName: record.projectName.trim(),
        projectNo: record.projectNo.trim(),
        remark: record.remark || '',
      }),
    )
  }

  static getModelWeightDisplay(project: ProjectRecord | null | undefined): string {
    if (!project || !DesignWorkflowForm.needsDesignWorkflow(project.natures)) return '-'
    return '-'
  }

  static createEditForm(row: DesignDrawingIssuePlanRow): DesignDrawingIssuePlanEditForm {
    return {
      projectNo: row.projectNo,
      designPlannedIssueDate: row.designPlannedIssueDate || '',
      designActualIssueDate: row.designActualIssueDate || '',
      tileLayoutPlannedIssueDate: row.tileLayoutPlannedIssueDate || '',
      tileLayoutActualIssueDate: row.tileLayoutActualIssueDate || '',
      floorDeckPlannedIssueDate: row.floorDeckPlannedIssueDate || '',
      floorDeckActualIssueDate: row.floorDeckActualIssueDate || '',
      remark: row.remark || '',
    }
  }

  static applyEditForm(
    row: DesignDrawingIssuePlanRow,
    form: DesignDrawingIssuePlanEditForm,
    projectMap?: Map<string, ProjectRecord>,
  ): DesignDrawingIssuePlanRow {
    const linkedProject = projectMap
      ? DesignDrawingIssuePlanForm.resolveLinkedProject(form.projectNo, projectMap)
      : null
    const projectNo = linkedProject?.projectNo ?? form.projectNo.trim()

    return {
      ...row,
      projectNo,
      projectName: DesignDrawingIssuePlanForm.resolveProjectName(
        { projectName: row.projectName, projectNo },
        linkedProject,
      ),
      linkedProject,
      designPlannedIssueDate: form.designPlannedIssueDate || null,
      designActualIssueDate: form.designActualIssueDate || null,
      tileLayoutPlannedIssueDate: form.tileLayoutPlannedIssueDate || null,
      tileLayoutActualIssueDate: form.tileLayoutActualIssueDate || null,
      floorDeckPlannedIssueDate: form.floorDeckPlannedIssueDate || null,
      floorDeckActualIssueDate: form.floorDeckActualIssueDate || null,
      remark: form.remark.trim(),
    }
  }
}
