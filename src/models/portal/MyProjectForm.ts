import { DetailWorkflowForm } from '@/models/biz/project/DetailWorkflowForm'
import type { DetailMainPhase } from '@/models/biz/project/DetailWorkflowForm'
import { ProjectForm } from '@/models/biz/project/ProjectForm'
import type {
  NatureProgressPhase,
  ProjectRecord,
  ProjectStatus,
} from '@/models/biz/project/ProjectForm'

export const MY_PROJECT_DESIGN_TEAM = '设计组'
export const MY_PROJECT_DETAIL_TEAM = '细化组'

export type MyProjectFlowSegmentKind = 'process' | 'design' | 'detail'

export type MyProjectFlowFilterKind = 'process' | 'design' | 'detail' | 'detailMain'

export interface MyProjectFlowFilterGroup {
  key: string
  label: string
  options: Array<{ value: string; label: string }>
}

export interface MyProjectFlowSegment {
  kind: MyProjectFlowSegmentKind
  label: string
  type: 'primary' | 'success' | 'warning' | 'danger' | 'info'
  editable: boolean
  usesDetailWorkflow: boolean
}

export class MyProjectForm {
  static canEditDesignProgress(personnelTeam: string, record: Pick<ProjectRecord, 'natures'>) {
    return (
      personnelTeam === MY_PROJECT_DESIGN_TEAM &&
      ProjectForm.isNatureApplicable(record, ProjectForm.NATURE.DESIGN)
    )
  }

  static canEditDetailProgress(personnelTeam: string, record: Pick<ProjectRecord, 'natures'>) {
    return (
      personnelTeam === MY_PROJECT_DETAIL_TEAM && ProjectForm.hasDetailGroupNature(record)
    )
  }

  static getFlowSegments(
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
    personnelTeam: string,
  ): MyProjectFlowSegment[] {
    const processMeta = ProjectForm.STATUS_MAP[record.status]
    const segments: MyProjectFlowSegment[] = [
      {
        kind: 'process',
        label: processMeta.label,
        type: processMeta.type,
        editable: true,
        usesDetailWorkflow: false,
      },
    ]

    if (ProjectForm.hasDualNatureTasks(record)) {
      segments.push({
        kind: 'design',
        ...ProjectForm.getNatureProgressMeta(record, ProjectForm.NATURE.DESIGN),
        editable: MyProjectForm.canEditDesignProgress(personnelTeam, record),
        usesDetailWorkflow: false,
      })
      segments.push({
        kind: 'detail',
        ...DetailWorkflowForm.getMainPhaseMeta(record),
        editable: MyProjectForm.canEditDetailProgress(personnelTeam, record),
        usesDetailWorkflow: DetailWorkflowForm.needsDetailWorkflow(record.natures),
      })
      return segments
    }

    if (
      DetailWorkflowForm.needsDetailWorkflow(record.natures) &&
      record.detailWorkflow
    ) {
      segments.push({
        kind: 'detail',
        ...DetailWorkflowForm.getMainPhaseMeta(record),
        editable: MyProjectForm.canEditDetailProgress(personnelTeam, record),
        usesDetailWorkflow: true,
      })
      return segments
    }

    if (ProjectForm.isNatureApplicable(record, ProjectForm.NATURE.DESIGN)) {
      segments.push({
        kind: 'design',
        ...ProjectForm.getNatureProgressMeta(record, ProjectForm.NATURE.DESIGN),
        editable: MyProjectForm.canEditDesignProgress(personnelTeam, record),
        usesDetailWorkflow: false,
      })
    } else if (ProjectForm.hasDetailGroupNature(record)) {
      segments.push({
        kind: 'detail',
        ...ProjectForm.getNatureProgressMeta(record, ProjectForm.NATURE.DETAIL),
        editable: MyProjectForm.canEditDetailProgress(personnelTeam, record),
        usesDetailWorkflow: false,
      })
    }

    return segments
  }

  static getAdminFlowSegments(
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
  ): MyProjectFlowSegment[] {
    const processMeta = ProjectForm.STATUS_MAP[record.status]
    const segments: MyProjectFlowSegment[] = [
      {
        kind: 'process',
        label: processMeta.label,
        type: processMeta.type,
        editable: true,
        usesDetailWorkflow: false,
      },
    ]

    if (ProjectForm.hasDualNatureTasks(record)) {
      segments.push({
        kind: 'design',
        ...ProjectForm.getNatureProgressMeta(record, ProjectForm.NATURE.DESIGN),
        editable: ProjectForm.isNatureApplicable(record, ProjectForm.NATURE.DESIGN),
        usesDetailWorkflow: false,
      })
      segments.push({
        kind: 'detail',
        ...DetailWorkflowForm.getMainPhaseMeta(record),
        editable: ProjectForm.hasDetailGroupNature(record),
        usesDetailWorkflow: DetailWorkflowForm.needsDetailWorkflow(record.natures),
      })
      return segments
    }

    if (
      DetailWorkflowForm.needsDetailWorkflow(record.natures) &&
      record.detailWorkflow
    ) {
      segments.push({
        kind: 'detail',
        ...DetailWorkflowForm.getMainPhaseMeta(record),
        editable: ProjectForm.hasDetailGroupNature(record),
        usesDetailWorkflow: true,
      })
      return segments
    }

    if (ProjectForm.isNatureApplicable(record, ProjectForm.NATURE.DESIGN)) {
      segments.push({
        kind: 'design',
        ...ProjectForm.getNatureProgressMeta(record, ProjectForm.NATURE.DESIGN),
        editable: true,
        usesDetailWorkflow: false,
      })
    } else if (ProjectForm.hasDetailGroupNature(record)) {
      segments.push({
        kind: 'detail',
        ...ProjectForm.getNatureProgressMeta(record, ProjectForm.NATURE.DETAIL),
        editable: true,
        usesDetailWorkflow: false,
      })
    }

    return segments
  }

  static getProcessStatusOptions() {
    return ProjectForm.STATUS_FORM_OPTIONS
  }

  static getDesignProgressOptions(record: ProjectRecord) {
    const currentPhase =
      ProjectForm.getNatureProgressPhase(record, ProjectForm.NATURE.DESIGN) ?? 'not_started'
    const phases: NatureProgressPhase[] = ['not_started', 'in_progress', 'completed']
    return phases.map((phase) => ({
      value: phase,
      label: ProjectForm.NATURE_PROGRESS_LABELS.design[phase],
      selected: phase === currentPhase,
    }))
  }

  static getSimpleDetailProgressOptions(record: ProjectRecord) {
    const currentPhase =
      ProjectForm.getNatureProgressPhase(record, ProjectForm.NATURE.DETAIL) ?? 'not_started'
    const phases: NatureProgressPhase[] = ['not_started', 'in_progress', 'completed']
    return phases.map((phase) => ({
      value: phase,
      label: ProjectForm.NATURE_PROGRESS_LABELS.detail[phase],
      selected: phase === currentPhase,
    }))
  }

  static progressPhaseToDesignCompleted(phase: NatureProgressPhase) {
    return phase === 'completed'
  }

  static progressPhaseToDetailCompleted(phase: NatureProgressPhase) {
    return phase === 'completed'
  }

  static buildProcessStatusPayload(status: ProjectStatus) {
    return { status }
  }

  static buildDesignProgressPayload(phase: NatureProgressPhase) {
    return { designCompleted: MyProjectForm.progressPhaseToDesignCompleted(phase) }
  }

  static buildSimpleDetailProgressPayload(phase: NatureProgressPhase) {
    return { detailCompleted: MyProjectForm.progressPhaseToDetailCompleted(phase) }
  }

  static encodeFlowFilter(kind: MyProjectFlowFilterKind, value: string) {
    return `${kind}:${value}`
  }

  static parseFlowFilter(filterValue: string): { kind: MyProjectFlowFilterKind; value: string } | null {
    const separatorIndex = filterValue.indexOf(':')
    if (separatorIndex <= 0) return null
    const kind = filterValue.slice(0, separatorIndex) as MyProjectFlowFilterKind
    const value = filterValue.slice(separatorIndex + 1)
    if (!value) return null
    if (kind !== 'process' && kind !== 'design' && kind !== 'detail' && kind !== 'detailMain') {
      return null
    }
    return { kind, value }
  }

  static getFlowFilterGroups(personnelTeam: string): MyProjectFlowFilterGroup[] {
    const groups: MyProjectFlowFilterGroup[] = [
      {
        key: 'process',
        label: '项目流程',
        options: ProjectForm.STATUS_FORM_OPTIONS.map((item) => ({
          value: MyProjectForm.encodeFlowFilter('process', item.value),
          label: item.label,
        })),
      },
    ]

    if (personnelTeam === MY_PROJECT_DESIGN_TEAM) {
      const phases: NatureProgressPhase[] = ['not_started', 'in_progress', 'completed']
      groups.push({
        key: 'design',
        label: '设计进度',
        options: phases.map((phase) => ({
          value: MyProjectForm.encodeFlowFilter('design', phase),
          label: ProjectForm.NATURE_PROGRESS_LABELS.design[phase],
        })),
      })
      return groups
    }

    if (personnelTeam === MY_PROJECT_DETAIL_TEAM) {
      const simplePhases: NatureProgressPhase[] = ['not_started', 'in_progress', 'completed']
      const detailMainOrder: DetailMainPhase[] = [
        'pending_modeling',
        'modeling',
        'drawing',
        'drawing_plate_layout',
        'drawing_finishing',
        'plate_layout_finishing',
        'detail_completed',
      ]

      groups.push({
        key: 'detail',
        label: '细化进度',
        options: [
          ...simplePhases.map((phase) => ({
            value: MyProjectForm.encodeFlowFilter('detail', phase),
            label: ProjectForm.NATURE_PROGRESS_LABELS.detail[phase],
          })),
          ...detailMainOrder.map((phase) => ({
            value: MyProjectForm.encodeFlowFilter('detailMain', phase),
            label: DetailWorkflowForm.MAIN_PHASE_LABELS[phase],
          })),
        ],
      })
    }

    return groups
  }

  static matchesFlowFilter(
    record: ProjectRecord,
    personnelTeam: string,
    filterValue: string,
  ): boolean {
    const parsed = MyProjectForm.parseFlowFilter(filterValue)
    if (!parsed) return false

    if (parsed.kind === 'process') {
      return record.status === (parsed.value as ProjectStatus)
    }

    if (parsed.kind === 'design') {
      if (personnelTeam !== MY_PROJECT_DESIGN_TEAM) return false
      const phase = ProjectForm.getNatureProgressPhase(record, ProjectForm.NATURE.DESIGN)
      return phase === parsed.value
    }

    if (parsed.kind === 'detail') {
      if (personnelTeam !== MY_PROJECT_DETAIL_TEAM) return false
      const usesWorkflow =
        DetailWorkflowForm.needsDetailWorkflow(record.natures) && Boolean(record.detailWorkflow)
      if (usesWorkflow) return false
      const phase = ProjectForm.getNatureProgressPhase(record, ProjectForm.NATURE.DETAIL)
      return phase === parsed.value
    }

    if (parsed.kind === 'detailMain') {
      if (personnelTeam !== MY_PROJECT_DETAIL_TEAM) return false
      if (
        !DetailWorkflowForm.needsDetailWorkflow(record.natures) ||
        !record.detailWorkflow
      ) {
        return false
      }
      const hasPlateLayout = DetailWorkflowForm.hasPlateLayoutPhase(record.natures)
      const phase = DetailWorkflowForm.deriveMainPhase(record.detailWorkflow, hasPlateLayout)
      return phase === parsed.value
    }

    return false
  }

  static matchesFlowFilters(
    record: ProjectRecord,
    personnelTeam: string,
    filterValues: readonly string[],
  ): boolean {
    if (!filterValues.length) return true
    return filterValues.some((filterValue) =>
      MyProjectForm.matchesFlowFilter(record, personnelTeam, filterValue),
    )
  }

  static getFlowFilterLabel(filterGroups: MyProjectFlowFilterGroup[], filterValue: string) {
    for (const group of filterGroups) {
      const matched = group.options.find((option) => option.value === filterValue)
      if (matched) return matched.label
    }
    return filterValue
  }

  /** 当前员工是否为该项目在本组的唯一负责人 */
  static isOwnProject(
    record: Pick<ProjectRecord, 'assignedPersonnel' | 'assignedPersonnelIds'>,
    personnelId: string,
    personnelTeam: string,
  ) {
    if (!personnelId || !record.assignedPersonnelIds.includes(personnelId)) return false
    const teamAssignees = record.assignedPersonnel.filter((person) => person.team === personnelTeam)
    return teamAssignees.length === 1 && teamAssignees[0]?.id === personnelId
  }

  /** 非本人负责的项目（同组另有负责人）可退出 */
  static canLeaveProject(
    record: Pick<ProjectRecord, 'assignedPersonnel' | 'assignedPersonnelIds'>,
    personnelId: string,
    personnelTeam: string,
  ) {
    if (!personnelId || !record.assignedPersonnelIds.includes(personnelId)) return false
    return !MyProjectForm.isOwnProject(record, personnelId, personnelTeam)
  }
}
