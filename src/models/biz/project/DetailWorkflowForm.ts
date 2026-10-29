import { ProjectForm } from './ProjectForm'
import type { ProjectNatureCode, ProjectRecord } from './ProjectForm'

export type DetailPhaseStatus = 'not_started' | 'in_progress' | 'completed' | 'not_applicable'

export type DetailWorkflowAction =
  | 'start_modeling'
  | 'complete_modeling'
  | 'reset_modeling'
  | 'reopen_modeling'
  | 'start_plate_layout'
  | 'complete_drawing'
  | 'reset_drawing'
  | 'reopen_drawing'
  | 'complete_plate_layout'
  | 'reset_plate_layout'
  | 'reopen_plate_layout'

export interface DetailWorkflowRecord {
  plateLayoutEnabled?: boolean
  modelingStatus: DetailPhaseStatus
  drawingStatus: DetailPhaseStatus
  plateLayoutStatus: DetailPhaseStatus
  modelingStartedAt: string
  modelingCompletedAt: string
  drawingStartedAt: string
  drawingCompletedAt: string
  plateLayoutStartedAt: string
  plateLayoutCompletedAt: string
  modelWeightTons: number | null
  modelWeightUpdatedAt: string
  modelWeightUpdatedBy: string
  modelWeightUpdatedByName: string
}

export interface DetailWorkflowEditForm {
  plateLayoutEnabled: boolean
  modelingStatus: DetailPhaseStatus
  modelingStartedAt: string
  modelingCompletedAt: string
  drawingStatus: DetailPhaseStatus
  drawingStartedAt: string
  drawingCompletedAt: string
  plateLayoutStatus: DetailPhaseStatus
  plateLayoutStartedAt: string
  plateLayoutCompletedAt: string
}

export interface DetailWorkflowPhaseRow {
  key: 'modeling' | 'drawing' | 'plate_layout'
  label: string
  statusKey: keyof Pick<
    DetailWorkflowEditForm,
    'modelingStatus' | 'drawingStatus' | 'plateLayoutStatus'
  >
  startedAtKey: keyof Pick<
    DetailWorkflowEditForm,
    'modelingStartedAt' | 'drawingStartedAt' | 'plateLayoutStartedAt'
  >
  completedAtKey: keyof Pick<
    DetailWorkflowEditForm,
    'modelingCompletedAt' | 'drawingCompletedAt' | 'plateLayoutCompletedAt'
  >
  statusOptions: DetailPhaseStatus[]
  editable: boolean
  hint?: string
}

export type DetailMainPhase =
  | 'pending_modeling'
  | 'modeling'
  | 'drawing'
  | 'drawing_plate_layout'
  | 'drawing_finishing'
  | 'plate_layout_finishing'
  | 'detail_completed'

export class DetailWorkflowForm {
  static readonly PHASE = {
    MODELING: 'modeling',
    DRAWING: 'drawing',
    PLATE_LAYOUT: 'plate_layout',
  } as const

  static readonly STATUS = {
    NOT_STARTED: 'not_started',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    NOT_APPLICABLE: 'not_applicable',
  } as const

  static readonly PHASE_LABELS: Record<string, string> = {
    modeling: '建模',
    drawing: '调图',
    plate_layout: '排板',
  }

  static readonly STATUS_LABELS: Record<DetailPhaseStatus, string> = {
    not_started: '未开始',
    in_progress: '进行中',
    completed: '已完成',
    not_applicable: '不适用',
  }

  static readonly STATUS_TYPE: Record<
    DetailPhaseStatus,
    'primary' | 'success' | 'warning' | 'info'
  > = {
    not_started: 'info',
    in_progress: 'primary',
    completed: 'success',
    not_applicable: 'info',
  }

  static readonly MAIN_PHASE_LABELS: Record<DetailMainPhase, string> = {
    pending_modeling: '待建模',
    modeling: '建模中',
    drawing: '调图中',
    drawing_plate_layout: '调图+排板',
    drawing_finishing: '调图收尾',
    plate_layout_finishing: '排板收尾',
    detail_completed: '细化完成',
  }

  static readonly MAIN_PHASE_TYPE: Record<
    DetailMainPhase,
    'primary' | 'success' | 'warning' | 'info'
  > = {
    pending_modeling: 'info',
    modeling: 'primary',
    drawing: 'primary',
    drawing_plate_layout: 'primary',
    drawing_finishing: 'primary',
    plate_layout_finishing: 'primary',
    detail_completed: 'success',
  }

  static readonly DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss'
  /** 调图阶段仅精确到年月 */
  static readonly YEAR_MONTH_FORMAT = 'YYYY-MM'

  static needsDetailWorkflow(natures: readonly ProjectNatureCode[]) {
    return natures.includes(ProjectForm.NATURE.DETAIL)
  }

  static normalizeYearMonth(value: string | null | undefined) {
    const text = (value || '').trim()
    if (!text) return ''
    return text.slice(0, 7)
  }

  static hasPlateLayoutPhase(
    workflow: Pick<DetailWorkflowRecord, 'plateLayoutEnabled'> | null | undefined,
  ) {
    if (!workflow) return false
    return workflow.plateLayoutEnabled !== false
  }

  static createEditForm(workflow: DetailWorkflowRecord): DetailWorkflowEditForm {
    return {
      plateLayoutEnabled: workflow.plateLayoutEnabled !== false,
      modelingStatus: workflow.modelingStatus,
      modelingStartedAt: workflow.modelingStartedAt,
      modelingCompletedAt: workflow.modelingCompletedAt,
      drawingStatus: workflow.drawingStatus,
      drawingStartedAt: DetailWorkflowForm.normalizeYearMonth(workflow.drawingStartedAt),
      drawingCompletedAt: DetailWorkflowForm.normalizeYearMonth(workflow.drawingCompletedAt),
      plateLayoutStatus: workflow.plateLayoutStatus,
      plateLayoutStartedAt: workflow.plateLayoutStartedAt,
      plateLayoutCompletedAt: workflow.plateLayoutCompletedAt,
    }
  }

  static toSavePayload(form: DetailWorkflowEditForm): DetailWorkflowEditForm {
    return {
      ...form,
      drawingStartedAt: DetailWorkflowForm.normalizeYearMonth(form.drawingStartedAt),
      drawingCompletedAt: DetailWorkflowForm.normalizeYearMonth(form.drawingCompletedAt),
    }
  }

  static getEditablePhaseRows(
    workflow: Pick<
      DetailWorkflowRecord,
      'plateLayoutEnabled' | 'plateLayoutStatus'
    > | null | undefined,
  ): DetailWorkflowPhaseRow[] {
    const hasPlateLayout = DetailWorkflowForm.hasPlateLayoutPhase(workflow)
    const baseStatusOptions: DetailPhaseStatus[] = [
      DetailWorkflowForm.STATUS.NOT_STARTED,
      DetailWorkflowForm.STATUS.IN_PROGRESS,
      DetailWorkflowForm.STATUS.COMPLETED,
    ]

    return [
      {
        key: 'modeling',
        label: DetailWorkflowForm.PHASE_LABELS.modeling,
        statusKey: 'modelingStatus',
        startedAtKey: 'modelingStartedAt',
        completedAtKey: 'modelingCompletedAt',
        statusOptions: baseStatusOptions,
        editable: true,
      },
      {
        key: 'drawing',
        label: DetailWorkflowForm.PHASE_LABELS.drawing,
        statusKey: 'drawingStatus',
        startedAtKey: 'drawingStartedAt',
        completedAtKey: 'drawingCompletedAt',
        statusOptions: baseStatusOptions,
        editable: true,
      },
      {
        key: 'plate_layout',
        label: DetailWorkflowForm.PHASE_LABELS.plate_layout,
        statusKey: 'plateLayoutStatus',
        startedAtKey: 'plateLayoutStartedAt',
        completedAtKey: 'plateLayoutCompletedAt',
        statusOptions: hasPlateLayout
          ? baseStatusOptions
          : [DetailWorkflowForm.STATUS.NOT_APPLICABLE],
        editable: hasPlateLayout,
        hint: hasPlateLayout
          ? '细化后钢板的排版，与排瓦（墙面板）/排楼承板不同。'
          : '本项目未启用钢板排板，可在下方开关开启。',
      },
    ]
  }

  static applyPlateLayoutEnabledChange(
    form: DetailWorkflowEditForm,
    enabled: boolean,
  ) {
    form.plateLayoutEnabled = enabled
    if (!enabled) {
      form.plateLayoutStatus = DetailWorkflowForm.STATUS.NOT_APPLICABLE
      form.plateLayoutStartedAt = ''
      form.plateLayoutCompletedAt = ''
    } else if (form.plateLayoutStatus === DetailWorkflowForm.STATUS.NOT_APPLICABLE) {
      form.plateLayoutStatus = DetailWorkflowForm.STATUS.NOT_STARTED
    }
  }

  static isMainFlowCompleted(
    workflow: DetailWorkflowRecord,
    hasPlateLayout: boolean,
  ) {
    if (workflow.modelingStatus !== DetailWorkflowForm.STATUS.COMPLETED) return false
    if (workflow.drawingStatus !== DetailWorkflowForm.STATUS.COMPLETED) return false
    if (
      hasPlateLayout &&
      workflow.plateLayoutStatus !== DetailWorkflowForm.STATUS.COMPLETED
    ) {
      return false
    }
    return true
  }

  static deriveMainPhase(
    workflow: DetailWorkflowRecord,
    hasPlateLayout: boolean,
  ): DetailMainPhase {
    if (DetailWorkflowForm.isMainFlowCompleted(workflow, hasPlateLayout)) {
      return 'detail_completed'
    }

    const { modelingStatus, drawingStatus, plateLayoutStatus } = workflow

    if (modelingStatus !== DetailWorkflowForm.STATUS.COMPLETED) {
      return modelingStatus === DetailWorkflowForm.STATUS.IN_PROGRESS
        ? 'modeling'
        : 'pending_modeling'
    }

    if (
      hasPlateLayout &&
      drawingStatus === DetailWorkflowForm.STATUS.IN_PROGRESS &&
      plateLayoutStatus === DetailWorkflowForm.STATUS.IN_PROGRESS
    ) {
      return 'drawing_plate_layout'
    }

    if (
      hasPlateLayout &&
      drawingStatus === DetailWorkflowForm.STATUS.COMPLETED &&
      plateLayoutStatus === DetailWorkflowForm.STATUS.IN_PROGRESS
    ) {
      return 'plate_layout_finishing'
    }

    if (
      hasPlateLayout &&
      drawingStatus === DetailWorkflowForm.STATUS.IN_PROGRESS &&
      plateLayoutStatus === DetailWorkflowForm.STATUS.COMPLETED
    ) {
      return 'drawing_finishing'
    }

    return 'drawing'
  }

  static getMainPhaseMeta(
    record: Pick<
      ProjectRecord,
      | 'natures'
      | 'detailWorkflow'
      | 'detailCompleted'
      | 'designCompleted'
      | 'assignedPersonnel'
      | 'designWorkPath'
      | 'detailWorkPath'
    >,
  ) {
    if (!DetailWorkflowForm.needsDetailWorkflow(record.natures) || !record.detailWorkflow) {
      return ProjectForm.getNatureProgressMeta(record, ProjectForm.NATURE.DETAIL)
    }

    const hasPlateLayout = DetailWorkflowForm.hasPlateLayoutPhase(record.detailWorkflow)
    const phase = DetailWorkflowForm.deriveMainPhase(record.detailWorkflow, hasPlateLayout)
    return {
      label: DetailWorkflowForm.MAIN_PHASE_LABELS[phase],
      type: DetailWorkflowForm.MAIN_PHASE_TYPE[phase],
    }
  }

  static getPhaseStatusMeta(status: DetailPhaseStatus) {
    return {
      label: DetailWorkflowForm.STATUS_LABELS[status],
      type: DetailWorkflowForm.STATUS_TYPE[status],
    }
  }

  static isTimeFieldEnabled(status: DetailPhaseStatus, field: 'started' | 'completed') {
    if (status === DetailWorkflowForm.STATUS.NOT_APPLICABLE) return false
    if (status === DetailWorkflowForm.STATUS.NOT_STARTED) return false
    if (field === 'started') {
      return status === DetailWorkflowForm.STATUS.IN_PROGRESS ||
        status === DetailWorkflowForm.STATUS.COMPLETED
    }
    return status === DetailWorkflowForm.STATUS.COMPLETED
  }

  static buildDrawingTimeSavePayload(
    workflow: DetailWorkflowRecord,
    field: 'drawingStartedAt' | 'drawingCompletedAt',
    value: string,
  ): DetailWorkflowEditForm {
    const form = DetailWorkflowForm.createEditForm(workflow)
    form[field] = DetailWorkflowForm.normalizeYearMonth(value)
    return DetailWorkflowForm.toSavePayload(form)
  }

  static buildPlateLayoutTimeSavePayload(
    workflow: DetailWorkflowRecord,
    field: 'plateLayoutStartedAt' | 'plateLayoutCompletedAt',
    value: string,
  ): DetailWorkflowEditForm {
    const form = DetailWorkflowForm.createEditForm(workflow)
    form[field] = value
    return DetailWorkflowForm.toSavePayload(form)
  }

  static formatWorkflowDatetimeDisplay(value: string | null | undefined) {
    const text = (value || '').trim()
    if (!text) return '-'
    if (text.length >= 16) return text.slice(5, 16)
    return text
  }

  static formatWorkflowYearMonthDisplay(value: string | null | undefined) {
    return DetailWorkflowForm.normalizeYearMonth(value) || '-'
  }

  static formatModelWeight(value: number | null | undefined) {
    if (value === null || value === undefined) return ''
    return String(value)
  }

  static formatModelWeightDisplay(value: number | null | undefined) {
    const text = DetailWorkflowForm.formatModelWeight(value)
    return text || '-'
  }

  static getModelWeightAuditTooltip(workflow: DetailWorkflowRecord | null | undefined) {
    if (!workflow?.modelWeightUpdatedAt) return ''
    const updater = workflow.modelWeightUpdatedByName || workflow.modelWeightUpdatedBy
    if (updater) {
      return `${updater} · ${workflow.modelWeightUpdatedAt}`
    }
    return workflow.modelWeightUpdatedAt
  }
}
