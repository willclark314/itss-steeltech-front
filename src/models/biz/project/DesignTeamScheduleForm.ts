import { ProjectForm } from './ProjectForm'
import type { ProjectRecord } from './ProjectForm'
import type { PersonnelRecord } from '@/models/personnel'

export interface DesignTeamMemberWorkload {
  personnelId: string
  name: string
  position: string
  projects: ProjectRecord[]
}

export interface UnfinishedDesignProjectFilters {
  keyword?: string
  /** 含已暂停 */
  includePaused?: boolean
  /** 含已取消 */
  includeCancelled?: boolean
  /** 含已分配人员 */
  includeAssigned?: boolean
}

export class DesignTeamScheduleForm {
  static readonly DESIGN_TEAM = '设计组' as const

  static isDesignProject(record: ProjectRecord) {
    return record.natures.includes(ProjectForm.NATURE.DESIGN)
  }

  /** 可排班：进行中或未开始 */
  static isSchedulableProject(record: ProjectRecord) {
    return (
      record.status === ProjectForm.STATUS.ACTIVE ||
      record.status === ProjectForm.STATUS.NOT_STARTED
    )
  }

  static isPausedProject(record: ProjectRecord) {
    return record.status === ProjectForm.STATUS.PAUSED
  }

  static isCancelledProject(record: ProjectRecord) {
    return record.status === ProjectForm.STATUS.CANCELLED
  }

  static isDesignCompleted(record: ProjectRecord) {
    return record.designCompleted
  }

  static isUnassigned(record: ProjectRecord) {
    return record.assignedPersonnel.length === 0
  }

  static isAssignedTo(record: ProjectRecord, personnelId: string) {
    return record.assignedPersonnelIds.includes(personnelId)
  }

  static filterDesignTeamMembers(personnel: PersonnelRecord[]) {
    return personnel
      .filter((item) => item.team === DesignTeamScheduleForm.DESIGN_TEAM)
      .filter((item) => item.status === 'active')
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
  }

  static applyMemberOrder(members: PersonnelRecord[], orderedIds: string[]) {
    if (!orderedIds.length) return members

    const orderMap = new Map(orderedIds.map((id, index) => [id, index]))
    return [...members].sort((a, b) => {
      const indexA = orderMap.get(a.id)
      const indexB = orderMap.get(b.id)
      if (indexA !== undefined && indexB !== undefined) return indexA - indexB
      if (indexA !== undefined) return -1
      if (indexB !== undefined) return 1
      return a.name.localeCompare(b.name, 'zh-CN')
    })
  }

  static reorderMembers(
    members: PersonnelRecord[],
    sourceId: string,
    targetId: string,
  ) {
    if (sourceId === targetId) return members

    const next = [...members]
    const fromIndex = next.findIndex((item) => item.id === sourceId)
    const toIndex = next.findIndex((item) => item.id === targetId)
    if (fromIndex < 0 || toIndex < 0) return members

    const [moved] = next.splice(fromIndex, 1)
    next.splice(toIndex, 0, moved)
    return next
  }

  static matchesLeftPanelProject(
    record: ProjectRecord,
    {
      includePaused = false,
      includeCancelled = false,
      includeAssigned = false,
    }: Pick<
      UnfinishedDesignProjectFilters,
      'includePaused' | 'includeCancelled' | 'includeAssigned'
    > = {},
  ) {
    if (!DesignTeamScheduleForm.isDesignProject(record)) return false

    const unassigned = DesignTeamScheduleForm.isUnassigned(record)
    const isSchedulable = DesignTeamScheduleForm.isSchedulableProject(record)
    const isPaused = DesignTeamScheduleForm.isPausedProject(record)
    const isCancelled = DesignTeamScheduleForm.isCancelledProject(record)
    const isDesignCompleted = DesignTeamScheduleForm.isDesignCompleted(record)

    if (isSchedulable && !isDesignCompleted && unassigned) return true
    if (includePaused && isPaused) return true
    if (includeCancelled && isCancelled) return true
    if (includeAssigned && isSchedulable && !isDesignCompleted && !unassigned)
      return true

    return false
  }

  static filterUnfinishedDesignProjects(
    projects: ProjectRecord[],
    filters: UnfinishedDesignProjectFilters = {},
  ) {
    const {
      keyword = '',
      includePaused = false,
      includeCancelled = false,
      includeAssigned = false,
    } = filters
    const normalizedKeyword = keyword.trim().toLowerCase()

    return projects
      .filter((item) =>
        DesignTeamScheduleForm.matchesLeftPanelProject(item, {
          includePaused,
          includeCancelled,
          includeAssigned,
        }),
      )
      .filter((item) => {
        if (!normalizedKeyword) return true
        return (
          item.projectNo.toLowerCase().includes(normalizedKeyword) ||
          item.name.toLowerCase().includes(normalizedKeyword) ||
          item.customer.toLowerCase().includes(normalizedKeyword) ||
          item.assignedPersonnel.some((person) =>
            person.name.toLowerCase().includes(normalizedKeyword),
          )
        )
      })
      .sort((a, b) => {
        const unassignedA = DesignTeamScheduleForm.isUnassigned(a) ? 0 : 1
        const unassignedB = DesignTeamScheduleForm.isUnassigned(b) ? 0 : 1
        if (unassignedA !== unassignedB) return unassignedA - unassignedB
        const dateA = a.receivedDate || ''
        const dateB = b.receivedDate || ''
        if (dateA !== dateB) return dateB.localeCompare(dateA)
        return a.projectNo.localeCompare(b.projectNo, 'zh-CN')
      })
  }

  static getMemberActiveDesignProjects(
    projects: ProjectRecord[],
    personnelId: string,
  ) {
    return projects
      .filter(
        (item) =>
          DesignTeamScheduleForm.isDesignProject(item) &&
          DesignTeamScheduleForm.isSchedulableProject(item) &&
          !DesignTeamScheduleForm.isDesignCompleted(item) &&
          DesignTeamScheduleForm.isAssignedTo(item, personnelId),
      )
      .sort((a, b) => a.projectNo.localeCompare(b.projectNo, 'zh-CN'))
  }

  static buildMemberWorkloads(
    members: PersonnelRecord[],
    projects: ProjectRecord[],
  ): DesignTeamMemberWorkload[] {
    return members.map((member) => ({
      personnelId: member.id,
      name: member.name,
      position: member.position,
      projects: DesignTeamScheduleForm.getMemberActiveDesignProjects(
        projects,
        member.id,
      ),
    }))
  }

  static formatAssignees(record: ProjectRecord) {
    if (!record.assignedPersonnel.length) return '未分配'
    return record.assignedPersonnel.map((person) => person.name).join('、')
  }

  static buildAssignmentAfterDrop(
    project: ProjectRecord,
    targetPersonnelId: string,
    sourcePersonnelId?: string,
  ) {
    if (sourcePersonnelId === targetPersonnelId) return null

    let nextIds = [...project.assignedPersonnelIds]

    if (sourcePersonnelId) {
      nextIds = nextIds.filter((id) => id !== sourcePersonnelId)
    }

    if (nextIds.includes(targetPersonnelId)) return null

    return [...nextIds, targetPersonnelId]
  }
}
