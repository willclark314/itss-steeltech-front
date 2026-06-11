/** 休假类型：计划轮休 / 延长休假 / 临时休假 */
export type LeaveEntryType = 'regular' | 'extended' | 'temporary'

/** 休假记录状态 */
export type LeaveEntryStatus = 'planned' | 'active' | 'completed' | 'cancelled'

/**
 * 员工休假周期策略（当前生效）
 * 例如：工作 135 天 → 休假 19 天，循环往复
 */
export interface PersonnelLeavePolicy {
  id: string
  personnelId: string
  workDays: number
  leaveDays: number
  /** 当前工作/休假周期的起始日 */
  cycleStartDate: string
  /** 本策略生效日期 */
  effectiveFrom: string
  remark?: string
}

/**
 * 休假周期调整记录
 * 记录工作天数、休假天数变更（间隔增减）
 */
export interface PersonnelLeavePolicyRevision {
  id: string
  personnelId: string
  effectiveFrom: string
  previousWorkDays: number
  previousLeaveDays: number
  workDays: number
  leaveDays: number
  reason?: string
  createdAt: string
}

/**
 * 单次休假记录
 * - regular：按周期计划的轮休
 * - extended：在计划休假基础上延长
 * - temporary：临时休假（不依附周期）
 */
export interface PersonnelLeaveEntry {
  id: string
  personnelId: string
  type: LeaveEntryType
  startDate: string
  endDate: string
  plannedDays: number
  actualDays?: number
  status: LeaveEntryStatus
  /** extended 类型时，关联被延长的原计划休假 */
  parentLeaveId?: string
  reason?: string
  remark?: string
  createdAt: string
}

export interface LeaveFilterParams {
  year?: number
  keyword?: string
  type?: string
  status?: string
}

/** 休假列表行（关联员工信息） */
export interface LeaveTableRow extends PersonnelLeaveEntry {
  employeeName: string
  employeeNo: string
  nationality: string
  position: string
}

/** 日历单日休假事件 */
export interface DayLeaveEvent {
  id: string
  personnelId: string
  employeeName: string
  employeeNo: string
  nationality: string
  type: LeaveEntryType
  status: LeaveEntryStatus
  startDate: string
  endDate: string
  reason?: string
}

export interface EmployeeColorItem {
  personnelId: string
  name: string
  color: string
}

export interface TeamMemberItem extends EmployeeColorItem {
  team: string
}

export interface TeamGroupItem {
  team: string
  members: TeamMemberItem[]
}

export interface CalendarDayCell {
  date: string
  day: number
  inMonth: boolean
  isToday: boolean
  events: DayLeaveEvent[]
}

export interface CalendarMonth {
  month: number
  label: string
  days: CalendarDayCell[]
}

export interface PersonnelLeaveSummary {
  policy: PersonnelLeavePolicy | null
  revisions: PersonnelLeavePolicyRevision[]
  entries: PersonnelLeaveEntry[]
  activeLeave: PersonnelLeaveEntry | null
  nextRegularLeaveStart: string | null
}

export class PersonnelLeaveForm {
  static readonly TYPE = {
    REGULAR: 'regular',
    EXTENDED: 'extended',
    TEMPORARY: 'temporary',
  } as const

  static readonly TYPE_OPTIONS = [
    { label: '计划轮休', value: PersonnelLeaveForm.TYPE.REGULAR },
    { label: '延长休假', value: PersonnelLeaveForm.TYPE.EXTENDED },
    { label: '临时休假', value: PersonnelLeaveForm.TYPE.TEMPORARY },
  ]

  static readonly TYPE_MAP: Record<LeaveEntryType, { label: string; type: 'primary' | 'warning' | 'info' }> = {
    regular: { label: '计划轮休', type: 'primary' },
    extended: { label: '延长休假', type: 'warning' },
    temporary: { label: '临时休假', type: 'info' },
  }

  static readonly STATUS = {
    PLANNED: 'planned',
    ACTIVE: 'active',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
  } as const

  static readonly STATUS_MAP: Record<
    LeaveEntryStatus,
    { label: string; type: 'info' | 'primary' | 'success' | 'danger' }
  > = {
    planned: { label: '计划中', type: 'info' },
    active: { label: '休假中', type: 'primary' },
    completed: { label: '已结束', type: 'success' },
    cancelled: { label: '已取消', type: 'danger' },
  }

  static readonly PERSONNEL_COUNT = 17

  static buildDefaultPolicies(): PersonnelLeavePolicy[] {
    return Array.from({ length: PersonnelLeaveForm.PERSONNEL_COUNT }, (_, index) => {
      const personnelId = `PER${String(index + 1).padStart(3, '0')}`
      return {
        id: `LVP${String(index + 1).padStart(3, '0')}`,
        personnelId,
        workDays: 135,
        leaveDays: 19,
        cycleStartDate: `2025-${String((index % 12) + 1).padStart(2, '0')}-15`,
        effectiveFrom: index === 0 ? '2026-01-15' : '2026-01-10',
        remark: index === 0 ? '由 140/18 调整为 135/19' : undefined,
      }
    })
  }

  static readonly DEFAULT_POLICIES: PersonnelLeavePolicy[] =
    PersonnelLeaveForm.buildDefaultPolicies()

  static readonly DEFAULT_REVISIONS: PersonnelLeavePolicyRevision[] = [
    {
      id: 'LVPR001',
      personnelId: 'PER001',
      effectiveFrom: '2026-01-15',
      previousWorkDays: 140,
      previousLeaveDays: 18,
      workDays: 135,
      leaveDays: 19,
      reason: '岗位调整，缩短轮休间隔',
      createdAt: '2026-01-14 10:00',
    },
  ]

  static addDays(dateStr: string, days: number) {
    const date = new Date(dateStr)
    date.setDate(date.getDate() + days)
    return date.toISOString().slice(0, 10)
  }

  static buildDefaultEntries(): PersonnelLeaveEntry[] {
    const entries: PersonnelLeaveEntry[] = []
    let sequence = 1

    const push = (entry: Omit<PersonnelLeaveEntry, 'id'>) => {
      entries.push({
        ...entry,
        id: `LVE${String(sequence).padStart(3, '0')}`,
      })
      sequence += 1
    }

    push({
      personnelId: 'PER001',
      type: 'regular',
      startDate: '2026-04-15',
      endDate: '2026-05-03',
      plannedDays: 19,
      actualDays: 19,
      status: 'completed',
      createdAt: '2026-03-01 09:00',
    })
    push({
      personnelId: 'PER001',
      type: 'extended',
      startDate: '2026-05-03',
      endDate: '2026-05-08',
      plannedDays: 5,
      actualDays: 5,
      status: 'completed',
      parentLeaveId: 'LVE001',
      reason: '家属事务，在原计划休假结束后延长 5 天',
      createdAt: '2026-04-20 14:00',
    })
    push({
      personnelId: 'PER001',
      type: 'regular',
      startDate: '2026-09-28',
      endDate: '2026-10-16',
      plannedDays: 19,
      status: 'planned',
      createdAt: '2026-06-01 09:00',
    })

    for (let index = 2; index <= PersonnelLeaveForm.PERSONNEL_COUNT; index += 1) {
      const personnelId = `PER${String(index).padStart(3, '0')}`
      const month = ((index * 2 - 1) % 12) + 1
      const startDay = Math.min(8 + (index % 12), 28)
      const startDate = `2026-${String(month).padStart(2, '0')}-${String(startDay).padStart(2, '0')}`
      const endDate = PersonnelLeaveForm.addDays(startDate, 18)

      let status: LeaveEntryStatus = 'completed'
      if (index === 6 || index === 7) {
        status = 'active'
      } else if (index % 5 === 0) {
        status = 'planned'
      }

      push({
        personnelId,
        type: 'regular',
        startDate,
        endDate,
        plannedDays: 19,
        actualDays: status === 'completed' ? 19 : undefined,
        status,
        createdAt: '2026-01-15 09:00',
      })
    }

    push({
      personnelId: 'PER010',
      type: 'temporary',
      startDate: '2026-06-01',
      endDate: '2026-06-05',
      plannedDays: 5,
      status: 'active',
      reason: '临时回国办理证件',
      createdAt: '2026-05-28 11:00',
    })

    return entries
  }

  static readonly DEFAULT_ENTRIES: PersonnelLeaveEntry[] =
    PersonnelLeaveForm.buildDefaultEntries()

  static clonePolicy(policy: PersonnelLeavePolicy): PersonnelLeavePolicy {
    return { ...policy }
  }

  static cloneRevision(revision: PersonnelLeavePolicyRevision): PersonnelLeavePolicyRevision {
    return { ...revision }
  }

  static cloneEntry(entry: PersonnelLeaveEntry): PersonnelLeaveEntry {
    return { ...entry }
  }

  static clonePolicies(data = PersonnelLeaveForm.DEFAULT_POLICIES) {
    return data.map((item) => PersonnelLeaveForm.clonePolicy(item))
  }

  static cloneRevisions(data = PersonnelLeaveForm.DEFAULT_REVISIONS) {
    return data.map((item) => PersonnelLeaveForm.cloneRevision(item))
  }

  static cloneEntries(data = PersonnelLeaveForm.DEFAULT_ENTRIES) {
    return data.map((item) => PersonnelLeaveForm.cloneEntry(item))
  }

  static getPolicyByPersonnelId(
    personnelId: string,
    policies: PersonnelLeavePolicy[] = PersonnelLeaveForm.DEFAULT_POLICIES,
  ) {
    return policies.find((item) => item.personnelId === personnelId) ?? null
  }

  static getRevisionsByPersonnelId(
    personnelId: string,
    revisions: PersonnelLeavePolicyRevision[] = PersonnelLeaveForm.DEFAULT_REVISIONS,
  ) {
    return revisions
      .filter((item) => item.personnelId === personnelId)
      .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))
  }

  static getEntriesByPersonnelId(
    personnelId: string,
    entries: PersonnelLeaveEntry[] = PersonnelLeaveForm.DEFAULT_ENTRIES,
  ) {
    return entries
      .filter((item) => item.personnelId === personnelId)
      .sort((a, b) => b.startDate.localeCompare(a.startDate))
  }

  static getActiveLeave(
    personnelId: string,
    entries: PersonnelLeaveEntry[] = PersonnelLeaveForm.DEFAULT_ENTRIES,
  ) {
    return entries.find((item) => item.personnelId === personnelId && item.status === 'active') ?? null
  }

  /** 根据当前策略推算下一轮计划轮休开始日 */
  static computeNextRegularLeaveStart(policy: PersonnelLeavePolicy, referenceDate = new Date()) {
    const cycleStart = new Date(policy.cycleStartDate)
    const cycleLength = policy.workDays + policy.leaveDays
    const msPerDay = 24 * 60 * 60 * 1000
    const daysSinceStart = Math.floor((referenceDate.getTime() - cycleStart.getTime()) / msPerDay)

    if (daysSinceStart < 0) {
      return policy.cycleStartDate
    }

    const cyclesPassed = Math.floor(daysSinceStart / cycleLength)
    const nextCycleStart = new Date(cycleStart.getTime() + cyclesPassed * cycleLength * msPerDay)
    const workPhaseEnd = new Date(nextCycleStart.getTime() + policy.workDays * msPerDay)

    if (referenceDate >= workPhaseEnd) {
      const nextCycle = new Date(nextCycleStart.getTime() + cycleLength * msPerDay)
      return nextCycle.toISOString().slice(0, 10)
    }

    return workPhaseEnd.toISOString().slice(0, 10)
  }

  static getLeaveSummary(
    personnelId: string,
    options: {
      policies?: PersonnelLeavePolicy[]
      revisions?: PersonnelLeavePolicyRevision[]
      entries?: PersonnelLeaveEntry[]
      referenceDate?: Date
    } = {},
  ): PersonnelLeaveSummary {
    const policies = options.policies ?? PersonnelLeaveForm.DEFAULT_POLICIES
    const revisions = options.revisions ?? PersonnelLeaveForm.DEFAULT_REVISIONS
    const entries = options.entries ?? PersonnelLeaveForm.DEFAULT_ENTRIES
    const policy = PersonnelLeaveForm.getPolicyByPersonnelId(personnelId, policies)

    return {
      policy,
      revisions: PersonnelLeaveForm.getRevisionsByPersonnelId(personnelId, revisions),
      entries: PersonnelLeaveForm.getEntriesByPersonnelId(personnelId, entries),
      activeLeave: PersonnelLeaveForm.getActiveLeave(personnelId, entries),
      nextRegularLeaveStart: policy
        ? PersonnelLeaveForm.computeNextRegularLeaveStart(policy, options.referenceDate)
        : null,
    }
  }

  static formatCycle(policy: PersonnelLeavePolicy) {
    return `工作 ${policy.workDays} 天 / 休假 ${policy.leaveDays} 天`
  }

  static getCurrentYear() {
    return new Date().getFullYear()
  }

  /** 休假记录与指定年份有交集 */
  static isEntryInYear(entry: PersonnelLeaveEntry, year: number) {
    const yearStart = `${year}-01-01`
    const yearEnd = `${year}-12-31`
    return entry.startDate <= yearEnd && entry.endDate >= yearStart
  }

  static buildTableRows(
    entries: PersonnelLeaveEntry[],
    personnelList: Array<{
      id: string
      name: string
      employeeNo: string
      nationality: string
      position: string
    }>,
    { year, keyword = '', type = '', status = '' }: LeaveFilterParams = {},
  ): LeaveTableRow[] {
    const personnelMap = new Map(personnelList.map((item) => [item.id, item]))
    const normalizedKeyword = keyword.trim().toLowerCase()

    return entries
      .filter((entry) => {
        if (year !== undefined && !PersonnelLeaveForm.isEntryInYear(entry, year)) {
          return false
        }

        const person = personnelMap.get(entry.personnelId)
        if (!person) return false

        const matchKeyword =
          !normalizedKeyword ||
          [
            person.name,
            person.employeeNo,
            person.nationality,
            person.position,
            entry.reason,
            entry.remark,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(normalizedKeyword)

        const matchType = !type || entry.type === type
        const matchStatus = !status || entry.status === status

        return matchKeyword && matchType && matchStatus
      })
      .map((entry) => {
        const person = personnelMap.get(entry.personnelId)!
        return {
          ...PersonnelLeaveForm.cloneEntry(entry),
          employeeName: person.name,
          employeeNo: person.employeeNo,
          nationality: person.nationality,
          position: person.position,
        }
      })
      .sort((a, b) => b.startDate.localeCompare(a.startDate))
  }

  static readonly MONTH_LABELS = [
    '一月', '二月', '三月', '四月', '五月', '六月',
    '七月', '八月', '九月', '十月', '十一月', '十二月',
  ] as const

  static readonly WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'] as const

  static readonly EMPLOYEE_COLORS = [
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

  static getEmployeeColorIndex(personnelId: string, personnelIds: string[]) {
    const index = personnelIds.indexOf(personnelId)
    if (index === -1) {
      let hash = 0
      for (const char of personnelId) {
        hash = (hash + char.charCodeAt(0)) % PersonnelLeaveForm.EMPLOYEE_COLORS.length
      }
      return hash
    }
    return index % PersonnelLeaveForm.EMPLOYEE_COLORS.length
  }

  static getEmployeeColor(personnelId: string, personnelIds: string[]) {
    const index = PersonnelLeaveForm.getEmployeeColorIndex(personnelId, personnelIds)
    return PersonnelLeaveForm.EMPLOYEE_COLORS[index]
  }

  static colorWithAlpha(hex: string, alpha = 0.38) {
    const normalized = hex.replace('#', '')
    const r = Number.parseInt(normalized.slice(0, 2), 16)
    const g = Number.parseInt(normalized.slice(2, 4), 16)
    const b = Number.parseInt(normalized.slice(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }

  static buildTeamGroups(
    personnelList: Array<{ id: string; name: string; team: string }>,
    rows: LeaveTableRow[],
    teams: readonly { label: string; value: string }[] = [],
  ): TeamGroupItem[] {
    const personnelIds = personnelList.map((item) => item.id)
    const activeIds = new Set(rows.map((row) => row.personnelId))

    return teams
      .map((team) => ({
        team: team.value,
        members: personnelList
          .filter((item) => item.team === team.value && activeIds.has(item.id))
          .map((item) => ({
            personnelId: item.id,
            name: item.name,
            team: item.team,
            color: PersonnelLeaveForm.getEmployeeColor(item.id, personnelIds),
          })),
      }))
      .filter((group) => group.members.length > 0)
  }

  static buildEmployeeColorLegend(
    personnelList: Array<{ id: string; name: string }>,
    rows: LeaveTableRow[],
  ): EmployeeColorItem[] {
    const personnelIds = personnelList.map((item) => item.id)
    const activeIds = new Set(rows.map((row) => row.personnelId))

    return personnelList
      .filter((item) => activeIds.has(item.id))
      .map((item) => ({
        personnelId: item.id,
        name: item.name,
        color: PersonnelLeaveForm.getEmployeeColor(item.id, personnelIds),
      }))
  }

  static getDayBackgroundStyle(
    events: DayLeaveEvent[],
    personnelIds: string[],
  ): Record<string, string> {
    if (!events.length) return {}

    const uniquePersonnelIds = [...new Set(events.map((event) => event.personnelId))]
    const colors = uniquePersonnelIds.map((id) =>
      PersonnelLeaveForm.getEmployeeColor(id, personnelIds),
    )

    if (colors.length === 1) {
      return { background: PersonnelLeaveForm.colorWithAlpha(colors[0]) }
    }

    const gradient = colors
      .map((color, index) => {
        const start = (index / colors.length) * 100
        const end = ((index + 1) / colors.length) * 100
        return `${PersonnelLeaveForm.colorWithAlpha(color, 0.45)} ${start}% ${end}%`
      })
      .join(', ')

    return { background: `linear-gradient(180deg, ${gradient})` }
  }

  static isDateInEntry(date: string, entry: PersonnelLeaveEntry) {
    return date >= entry.startDate && date <= entry.endDate
  }

  static toDayLeaveEvent(row: LeaveTableRow): DayLeaveEvent {
    return {
      id: row.id,
      personnelId: row.personnelId,
      employeeName: row.employeeName,
      employeeNo: row.employeeNo,
      nationality: row.nationality,
      type: row.type,
      status: row.status,
      startDate: row.startDate,
      endDate: row.endDate,
      reason: row.reason,
    }
  }

  static getDayEvents(date: string, rows: LeaveTableRow[]) {
    return rows
      .filter((row) => PersonnelLeaveForm.isDateInEntry(date, row))
      .map((row) => PersonnelLeaveForm.toDayLeaveEvent(row))
  }

  static formatDate(year: number, month: number, day: number) {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  static buildMonthDays(year: number, month: number, rows: LeaveTableRow[], today = new Date()) {
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
      const date = PersonnelLeaveForm.formatDate(year, month, day)
      const isToday =
        today.getFullYear() === year &&
        today.getMonth() + 1 === month &&
        today.getDate() === day

      cells.push({
        date,
        day,
        inMonth: true,
        isToday,
        events: PersonnelLeaveForm.getDayEvents(date, rows),
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

  static buildYearCalendar(year: number, rows: LeaveTableRow[], today = new Date()): CalendarMonth[] {
    return PersonnelLeaveForm.MONTH_LABELS.map((label, index) => {
      const month = index + 1
      return {
        month,
        label,
        days: PersonnelLeaveForm.buildMonthDays(year, month, rows, today),
      }
    })
  }
}
