import { PersonnelForm } from '../../personnel/PersonnelForm'
import { ProjectForm } from './ProjectForm'
import type { ProjectAssignee, ProjectNatureCode, ProjectRecord, ProjectStatus } from './ProjectForm'

export interface ProjectScheduleRow {
  projectNo: string
  name: string
  customer: string
  status: ProjectStatus
  natures: ProjectNatureCode[]
  assignedPersonnelIds: string[]
  assignedPersonnel: ProjectAssignee[]
  plannedStartDate: string
  plannedEndDate: string
}

export interface DayProjectEvent {
  projectNo: string
  name: string
  customer: string
  status: ProjectStatus
  natures: ProjectNatureCode[]
  assignedPersonnelIds: string[]
  assignedPersonnel: ProjectAssignee[]
  plannedStartDate: string
  plannedEndDate: string
}

export interface PersonnelColorItem {
  personnelId: string
  name: string
  team: string
  color: string
}

export interface TeamGroupItem {
  team: string
  members: PersonnelColorItem[]
}

export interface CalendarDayCell {
  date: string
  day: number
  inMonth: boolean
  isToday: boolean
  events: DayProjectEvent[]
}

export interface CalendarMonth {
  month: number
  label: string
  days: CalendarDayCell[]
}

export class ProjectScheduleForm {
  static readonly MONTH_LABELS = [
    '一月', '二月', '三月', '四月', '五月', '六月',
    '七月', '八月', '九月', '十月', '十一月', '十二月',
  ] as const

  static readonly WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'] as const

  static readonly PERSONNEL_COLORS = [
    '#409EFF',
    '#E6A23C',
    '#67C23A',
    '#F56C6C',
    '#9254DE',
    '#13C2C2',
    '#EB2F96',
    '#FAAD14',
    '#2F54EB',
    '#52C41A',
    '#FF4D4F',
    '#36CFC9',
  ] as const

  static readonly TEAM_OPTIONS = PersonnelForm.TEAM_OPTIONS

  static getCurrentYear() {
    return new Date().getFullYear()
  }

  static getProjectEndDate(row: Pick<ProjectScheduleRow, 'plannedStartDate' | 'plannedEndDate'>) {
    return row.plannedEndDate || row.plannedStartDate
  }

  static isProjectInYear(
    project: Pick<ProjectScheduleRow, 'plannedStartDate' | 'plannedEndDate'>,
    year: number,
  ) {
    if (!project.plannedStartDate) return false

    const yearStart = `${year}-01-01`
    const yearEnd = `${year}-12-31`
    const endDate = ProjectScheduleForm.getProjectEndDate(project)

    return project.plannedStartDate <= yearEnd && endDate >= yearStart
  }

  static buildScheduleRows(projects: ProjectRecord[], year?: number): ProjectScheduleRow[] {
    return projects
      .filter((project) => {
        if (!project.plannedStartDate) return false
        return year === undefined || ProjectScheduleForm.isProjectInYear(project, year)
      })
      .map((project) => ({
        projectNo: project.projectNo,
        name: project.name,
        customer: project.customer,
        status: project.status,
        natures: [...project.natures],
        assignedPersonnelIds: [...project.assignedPersonnelIds],
        assignedPersonnel: project.assignedPersonnel.map((person) => ({ ...person })),
        plannedStartDate: project.plannedStartDate,
        plannedEndDate: project.plannedEndDate,
      }))
      .sort((a, b) => a.plannedStartDate.localeCompare(b.plannedStartDate))
  }

  static collectPersonnelIds(rows: ProjectScheduleRow[]) {
    return [
      ...new Set(rows.flatMap((row) => row.assignedPersonnelIds)),
    ]
  }

  static getPersonnelColorIndex(personnelId: string, personnelIds: string[]) {
    const index = personnelIds.indexOf(personnelId)
    if (index === -1) {
      let hash = 0
      for (const char of personnelId) {
        hash = (hash + char.charCodeAt(0)) % ProjectScheduleForm.PERSONNEL_COLORS.length
      }
      return hash
    }
    return index % ProjectScheduleForm.PERSONNEL_COLORS.length
  }

  static getPersonnelColor(personnelId: string, personnelIds: string[]) {
    const index = ProjectScheduleForm.getPersonnelColorIndex(personnelId, personnelIds)
    return ProjectScheduleForm.PERSONNEL_COLORS[index]
  }

  static colorWithAlpha(hex: string, alpha = 0.38) {
    const normalized = hex.replace('#', '')
    const r = Number.parseInt(normalized.slice(0, 2), 16)
    const g = Number.parseInt(normalized.slice(2, 4), 16)
    const b = Number.parseInt(normalized.slice(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  static buildTeamPersonnelGroups(
    rows: ProjectScheduleRow[],
    teams: readonly { label: string; value: string }[] = ProjectScheduleForm.TEAM_OPTIONS,
  ): TeamGroupItem[] {
    const personnelIds = ProjectScheduleForm.collectPersonnelIds(rows)

    return teams
      .map((team) => {
        const memberMap = new Map<string, PersonnelColorItem>()

        for (const row of rows) {
          for (const person of row.assignedPersonnel) {
            if (person.team !== team.value || memberMap.has(person.id)) continue
            memberMap.set(person.id, {
              personnelId: person.id,
              name: person.name,
              team: person.team,
              color: ProjectScheduleForm.getPersonnelColor(person.id, personnelIds),
            })
          }
        }

        return {
          team: team.value,
          members: [...memberMap.values()].sort((a, b) =>
            a.name.localeCompare(b.name, 'zh-CN'),
          ),
        }
      })
      .filter((group) => group.members.length > 0)
  }

  static isPersonVisible(personnelId: string, personVisible: Record<string, boolean>) {
    return personVisible[personnelId] ?? true
  }

  static isRowVisible(
    row: ProjectScheduleRow,
    _groupVisible: Record<string, boolean>,
    personVisible: Record<string, boolean>,
  ) {
    if (!row.assignedPersonnelIds.length) return false
    return row.assignedPersonnel.some((person) =>
      ProjectScheduleForm.isPersonVisible(person.id, personVisible),
    )
  }

  static filterDayEventsByVisiblePersonnel(
    events: DayProjectEvent[],
    personVisible: Record<string, boolean>,
  ) {
    return events
      .map((event) => {
        const assignedPersonnel = event.assignedPersonnel.filter((person) =>
          ProjectScheduleForm.isPersonVisible(person.id, personVisible),
        )
        const assignedPersonnelIds = event.assignedPersonnelIds.filter((id) =>
          ProjectScheduleForm.isPersonVisible(id, personVisible),
        )

        return {
          ...event,
          assignedPersonnel,
          assignedPersonnelIds,
        }
      })
      .filter((event) => event.assignedPersonnelIds.length > 0)
  }

  static filterVisibleRows(
    rows: ProjectScheduleRow[],
    groupVisible: Record<string, boolean>,
    personVisible: Record<string, boolean>,
  ) {
    return rows.filter((row) =>
      ProjectScheduleForm.isRowVisible(row, groupVisible, personVisible),
    )
  }

  static getDayBackgroundStyle(
    events: DayProjectEvent[],
    personnelIds: string[],
  ): Record<string, string> {
    if (!events.length) return {}

    const uniquePersonnelIds = [
      ...new Set(events.flatMap((event) => event.assignedPersonnelIds)),
    ]
    const colors = uniquePersonnelIds.map((id) =>
      ProjectScheduleForm.getPersonnelColor(id, personnelIds),
    )

    if (colors.length === 1) {
      return { background: ProjectScheduleForm.colorWithAlpha(colors[0]) }
    }

    const gradient = colors
      .map((color, index) => {
        const start = (index / colors.length) * 100
        const end = ((index + 1) / colors.length) * 100
        return `${ProjectScheduleForm.colorWithAlpha(color, 0.45)} ${start}% ${end}%`
      })
      .join(', ')

    return { background: `linear-gradient(180deg, ${gradient})` }
  }

  static isDateInProject(date: string, row: ProjectScheduleRow) {
    const endDate = ProjectScheduleForm.getProjectEndDate(row)
    return date >= row.plannedStartDate && date <= endDate
  }

  static toDayProjectEvent(row: ProjectScheduleRow): DayProjectEvent {
    return {
      projectNo: row.projectNo,
      name: row.name,
      customer: row.customer,
      status: row.status,
      natures: [...row.natures],
      assignedPersonnelIds: [...row.assignedPersonnelIds],
      assignedPersonnel: row.assignedPersonnel.map((person) => ({ ...person })),
      plannedStartDate: row.plannedStartDate,
      plannedEndDate: row.plannedEndDate,
    }
  }

  static getDayEvents(date: string, rows: ProjectScheduleRow[]) {
    return rows
      .filter((row) => ProjectScheduleForm.isDateInProject(date, row))
      .map((row) => ProjectScheduleForm.toDayProjectEvent(row))
  }

  static getPersonDayEvents(
    date: string,
    rows: ProjectScheduleRow[],
    personnelId: string,
  ) {
    if (!date) return []

    return rows
      .filter(
        (row) =>
          row.assignedPersonnelIds.includes(personnelId) &&
          ProjectScheduleForm.isDateInProject(date, row),
      )
      .map((row) => ProjectScheduleForm.toDayProjectEvent(row))
  }

  static formatDate(year: number, month: number, day: number) {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  static buildMonthDays(
    year: number,
    month: number,
    rows: ProjectScheduleRow[],
    today = new Date(),
  ) {
    const firstWeekday = new Date(year, month - 1, 1).getDay()
    const mondayOffset = (firstWeekday + 6) % 7
    const daysInMonth = new Date(year, month, 0).getDate()
    const cells: CalendarDayCell[] = []

    for (let i = 0; i < mondayOffset; i += 1) {
      cells.push({
        date: '',
        day: 0,
        inMonth: false,
        isToday: false,
        events: [],
      })
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = ProjectScheduleForm.formatDate(year, month, day)
      const isToday =
        today.getFullYear() === year &&
        today.getMonth() + 1 === month &&
        today.getDate() === day

      cells.push({
        date,
        day,
        inMonth: true,
        isToday,
        events: ProjectScheduleForm.getDayEvents(date, rows),
      })
    }

    while (cells.length % 7 !== 0) {
      cells.push({
        date: '',
        day: 0,
        inMonth: false,
        isToday: false,
        events: [],
      })
    }

    return cells
  }

  static buildYearCalendar(
    year: number,
    rows: ProjectScheduleRow[],
    today = new Date(),
  ): CalendarMonth[] {
    return ProjectScheduleForm.MONTH_LABELS.map((label, index) => {
      const month = index + 1
      return {
        month,
        label,
        days: ProjectScheduleForm.buildMonthDays(year, month, rows, today),
      }
    })
  }

  static formatEventRange(event: DayProjectEvent) {
    const endDate = event.plannedEndDate || event.plannedStartDate
    if (endDate === event.plannedStartDate) {
      return event.plannedStartDate
    }
    return `${event.plannedStartDate} ~ ${endDate}`
  }

  static formatAssigneeNames(event: DayProjectEvent) {
    if (!event.assignedPersonnel.length) return '未分配'
    return event.assignedPersonnel.map((person) => person.name).join('、')
  }

  static getStatusLabel(status: ProjectStatus) {
    return ProjectForm.STATUS_MAP[status]?.label ?? status
  }

  static getNatureLabels(natures: ProjectNatureCode[]) {
    return natures.map((nature) => ProjectForm.getNatureLabel(nature)).filter(Boolean).join('、')
  }
}
