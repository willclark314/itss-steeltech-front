import { ProjectForm } from '@/models/biz/project'
import { ProjectScheduleForm } from '@/models/biz/project'
import type { ProjectRecord } from '@/models/biz/project'

export interface MyProjectRangeEvent {
  projectNo: string
  name: string
  actualStartDate: string
  actualEndDate: string
  plannedEndDate: string
  color: string
}

export interface MyProjectMilestone {
  projectNo: string
  name: string
  color: string
  kind: 'start' | 'actualEnd' | 'plannedEnd'
}

export interface MyCalendarDayCell {
  date: string
  day: number
  inMonth: boolean
  isToday: boolean
  projects: MyProjectRangeEvent[]
}

export interface MyCalendarMonthView {
  year: number
  month: number
  label: string
  isCenter: boolean
  days: MyCalendarDayCell[]
}

export class MyCalendarForm {
  static readonly WEEKDAY_LABELS = ProjectScheduleForm.WEEKDAY_LABELS
  static readonly PROJECT_FILL_ALPHA = 0.28
  static readonly PROJECT_BORDER_WIDTH = 2

  static getTodayParts(today = new Date()) {
    return {
      year: today.getFullYear(),
      month: today.getMonth() + 1,
    }
  }

  static shiftMonth(year: number, month: number, delta: number) {
    const date = new Date(year, month - 1 + delta, 1)
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
    }
  }

  static formatMonthLabel(year: number, month: number) {
    return `${year}年${ProjectScheduleForm.MONTH_LABELS[month - 1]}`
  }

  static parseDateParts(date: string) {
    const trimmed = date.trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null

    const [year, month, day] = trimmed.split('-').map(Number)
    if (!year || !month || !day) return null
    return { year, month, day }
  }

  static getProjectFocusDate(project: ProjectRecord) {
    const actualStart = (project.actualStartDate || '').trim()
    if (actualStart) return actualStart

    const actualEnd = (project.actualEndDate || '').trim()
    if (actualEnd) return actualEnd

    const plannedEnd = (project.plannedEndDate || '').trim()
    if (plannedEnd) return plannedEnd

    return null
  }

  static getProjectFocusMonth(project: ProjectRecord) {
    const focusDate = MyCalendarForm.getProjectFocusDate(project)
    if (!focusDate) return null
    return MyCalendarForm.parseDateParts(focusDate)
  }

  static isDayHighlightedForProject(cell: MyCalendarDayCell, highlightedProjectNo?: string) {
    if (!highlightedProjectNo || !cell.inMonth) return false

    const targetNo = ProjectForm.parseBaseProjectNo(highlightedProjectNo)
    return cell.projects.some(
      (project) => ProjectForm.parseBaseProjectNo(project.projectNo) === targetNo,
    )
  }

  static getProjectColor(projectNo: string) {
    let hash = 0
    for (const char of projectNo) {
      hash = (hash + char.charCodeAt(0)) % ProjectScheduleForm.PERSONNEL_COLORS.length
    }
    return ProjectScheduleForm.PERSONNEL_COLORS[hash]!
  }

  static toProjectRangeEvent(project: ProjectRecord): MyProjectRangeEvent {
    return {
      projectNo: project.projectNo,
      name: project.name,
      actualStartDate: (project.actualStartDate || '').trim(),
      actualEndDate: (project.actualEndDate || '').trim(),
      plannedEndDate: (project.plannedEndDate || '').trim(),
      color: MyCalendarForm.getProjectColor(project.projectNo),
    }
  }

  static isDateInActualFillRange(
    date: string,
    event: Pick<MyProjectRangeEvent, 'actualStartDate' | 'actualEndDate'>,
  ) {
    const { actualStartDate: start, actualEndDate: end } = event
    if (!start || !end) return false
    return date >= start && date <= end
  }

  static isDateInPlannedBorderRange(
    date: string,
    event: Pick<MyProjectRangeEvent, 'actualStartDate' | 'plannedEndDate'>,
  ) {
    const { actualStartDate: start, plannedEndDate: end } = event
    if (!start || !end) return false
    return date >= start && date <= end
  }

  static isProjectDayVisible(date: string, event: MyProjectRangeEvent) {
    if (MyCalendarForm.isDateInActualFillRange(date, event)) return true
    if (MyCalendarForm.isDateInPlannedBorderRange(date, event)) return true
    return (
      date === event.actualStartDate ||
      date === event.actualEndDate ||
      date === event.plannedEndDate
    )
  }

  static getProjectDayEvents(date: string, projects: ProjectRecord[]): MyProjectRangeEvent[] {
    if (!date) return []
    return projects
      .map((project) => MyCalendarForm.toProjectRangeEvent(project))
      .filter((event) => MyCalendarForm.isProjectDayVisible(date, event))
  }

  static getProjectMilestones(date: string, projects: MyProjectRangeEvent[]): MyProjectMilestone[] {
    if (!date) return []

    const milestones: MyProjectMilestone[] = []
    for (const project of projects) {
      if (project.actualStartDate === date) {
        milestones.push({
          projectNo: project.projectNo,
          name: project.name,
          color: project.color,
          kind: 'start',
        })
      }
      if (project.actualEndDate === date) {
        milestones.push({
          projectNo: project.projectNo,
          name: project.name,
          color: project.color,
          kind: 'actualEnd',
        })
      }
      if (project.plannedEndDate === date) {
        milestones.push({
          projectNo: project.projectNo,
          name: project.name,
          color: project.color,
          kind: 'plannedEnd',
        })
      }
    }
    return milestones
  }

  static buildMonthView(
    year: number,
    month: number,
    projects: ProjectRecord[],
    options: { isCenter?: boolean; today?: Date } = {},
  ): MyCalendarMonthView {
    const baseDays = ProjectScheduleForm.buildMonthDays(year, month, [], options.today)
    return {
      year,
      month,
      label: MyCalendarForm.formatMonthLabel(year, month),
      isCenter: options.isCenter ?? false,
      days: baseDays.map((cell) => ({
        date: cell.date,
        day: cell.day,
        inMonth: cell.inMonth,
        isToday: cell.isToday,
        projects: cell.inMonth ? MyCalendarForm.getProjectDayEvents(cell.date, projects) : [],
      })),
    }
  }

  static buildThreeMonthViews(
    centerYear: number,
    centerMonth: number,
    projects: ProjectRecord[],
    today = new Date(),
  ): MyCalendarMonthView[] {
    const prev = MyCalendarForm.shiftMonth(centerYear, centerMonth, -1)
    const next = MyCalendarForm.shiftMonth(centerYear, centerMonth, 1)

    return [
      MyCalendarForm.buildMonthView(prev.year, prev.month, projects, { today }),
      MyCalendarForm.buildMonthView(centerYear, centerMonth, projects, {
        isCenter: true,
        today,
      }),
      MyCalendarForm.buildMonthView(next.year, next.month, projects, { today }),
    ]
  }

  static hasDayEvents(cell: MyCalendarDayCell) {
    return cell.inMonth && cell.projects.length > 0
  }

  static formatProjectTooltip(event: MyProjectRangeEvent) {
    const lines = [`项目 ${event.projectNo} · ${event.name}`]
    if (event.actualStartDate) lines.push(`实际开始：${event.actualStartDate}`)
    if (event.actualEndDate) lines.push(`实际完成：${event.actualEndDate}`)
    if (event.plannedEndDate) lines.push(`计划完成：${event.plannedEndDate}`)
    return lines.join('\n')
  }

  static formatDayTooltip(cell: MyCalendarDayCell) {
    if (!MyCalendarForm.hasDayEvents(cell)) {
      return `${cell.date}\n无相关事项`
    }

    const lines: string[] = []
    for (const project of cell.projects) {
      lines.push(MyCalendarForm.formatProjectTooltip(project))
    }
    return `${cell.date}\n${lines.join('\n')}`
  }

  static getDayClass(cell: MyCalendarDayCell) {
    if (!cell.inMonth) return 'is-outside'
    const classes: string[] = []
    if (cell.projects.length) classes.push('has-project')
    if (cell.projects.some((project) => MyCalendarForm.isDateInActualFillRange(cell.date, project))) {
      classes.push('has-project-fill')
    }
    if (cell.projects.some((project) => MyCalendarForm.isDateInPlannedBorderRange(cell.date, project))) {
      classes.push('has-project-border')
    }
    if (MyCalendarForm.hasDayEvents(cell)) classes.push('has-events')
    return classes
  }

  static buildFillBackground(projects: MyProjectRangeEvent[]): string | undefined {
    if (projects.length === 1) {
      return ProjectScheduleForm.colorWithAlpha(
        projects[0]!.color,
        MyCalendarForm.PROJECT_FILL_ALPHA,
      )
    }
    if (projects.length > 1) {
      const gradient = projects
        .map((project, index) => {
          const start = (index / projects.length) * 100
          const end = ((index + 1) / projects.length) * 100
          return `${ProjectScheduleForm.colorWithAlpha(project.color, MyCalendarForm.PROJECT_FILL_ALPHA)} ${start}% ${end}%`
        })
        .join(', ')
      return `linear-gradient(180deg, ${gradient})`
    }
    return undefined
  }

  static buildAlternatingBorderBackground(colors: string[]): string {
    const segmentSize = 360 / colors.length
    const stops = colors
      .map((color, index) => {
        const start = segmentSize * index
        const end = segmentSize * (index + 1)
        return `${color} ${start}deg ${end}deg`
      })
      .join(', ')
    return `conic-gradient(from -45deg, ${stops})`
  }

  static getDayStyle(cell: MyCalendarDayCell) {
    if (!cell.inMonth || !cell.projects.length) return undefined

    const fillProjects = cell.projects.filter((project) =>
      MyCalendarForm.isDateInActualFillRange(cell.date, project),
    )
    const borderProjects = cell.projects.filter((project) =>
      MyCalendarForm.isDateInPlannedBorderRange(cell.date, project),
    )

    const fillBackground = MyCalendarForm.buildFillBackground(fillProjects)
    const borderColors = borderProjects.map((project) => project.color)
    const borderWidth = MyCalendarForm.PROJECT_BORDER_WIDTH
    const style: Record<string, string> = {}

    if (borderColors.length === 0) {
      if (fillBackground) style.background = fillBackground
    } else if (borderColors.length === 1) {
      if (fillBackground) style.background = fillBackground
      style.boxShadow = `inset 0 0 0 ${borderWidth}px ${borderColors[0]}`
    } else {
      const innerLayer = fillBackground ?? 'transparent'
      style.background = `${innerLayer} padding-box, ${MyCalendarForm.buildAlternatingBorderBackground(borderColors)} border-box`
      style.border = `${borderWidth}px solid transparent`
      style.backgroundClip = 'padding-box, border-box'
    }

    return Object.keys(style).length ? style : undefined
  }
}
