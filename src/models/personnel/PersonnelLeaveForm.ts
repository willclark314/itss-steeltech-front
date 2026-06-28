/** 休假类型：计划轮休 / 延长休假 / 提前休假 */
export type LeaveEntryType = 'regular' | 'extended' | 'early'

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
 * - early：提前休假（未满工作天数即申请休假）
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
    EARLY: 'early',
  } as const

  static readonly TYPE_OPTIONS = [
    { label: '计划轮休', value: PersonnelLeaveForm.TYPE.REGULAR },
    { label: '延长休假', value: PersonnelLeaveForm.TYPE.EXTENDED },
    { label: '提前休假', value: PersonnelLeaveForm.TYPE.EARLY },
  ]

  static readonly TYPE_MAP: Record<LeaveEntryType, { label: string; type: 'primary' | 'warning' | 'info' }> = {
    regular: { label: '计划轮休', type: 'primary' },
    extended: { label: '延长休假', type: 'warning' },
    early: { label: '提前休假', type: 'info' },
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

  /** 默认休假策略参数 — 不入库，纯计算 */
  static readonly POLICY_DEFAULTS = {
    /** 默认工作天数（间隔 150 天休一次） */
    workDays: 150,
    /** 每次休假天数 */
    leaveDays: 19,
    /** 周期错开的基准日期，各人从此日起按索引偏移 */
    baseDate: '2024-06-01',
  } as const

  /** 完整周期长度（天） */
  static get CYCLE_DAYS(): number {
    return PersonnelLeaveForm.POLICY_DEFAULTS.workDays + PersonnelLeaveForm.POLICY_DEFAULTS.leaveDays
  }

  /**
   * 根据实际人员列表生成每人一条休假策略。
   * 所有人的 workDays/leaveDays 取 POLICY_DEFAULTS，
   * cycleStartDate 按人员索引均匀错开（错开总跨度 = 一个完整周期），
   * 避免多人同时休假。
   */
  static generatePolicies(personnelList: Array<{ id: string }>): PersonnelLeavePolicy[] {
    const { workDays, leaveDays, baseDate } = PersonnelLeaveForm.POLICY_DEFAULTS
    const total = personnelList.length || 1
    const staggerStep = Math.floor(PersonnelLeaveForm.CYCLE_DAYS / total)

    return personnelList.map((person, index) => {
      const offsetDays = index * staggerStep
      const cycleStart = new Date(baseDate)
      cycleStart.setDate(cycleStart.getDate() + offsetDays)

      return {
        id: `POL_${person.id}`,
        personnelId: person.id,
        workDays,
        leaveDays,
        cycleStartDate: cycleStart.toISOString().slice(0, 10),
        effectiveFrom: baseDate,
      }
    })
  }

  /**
   * 根据策略计算指定年份内所有的「计划轮休」休假段。
   * 不依赖外部状态 — 纯函数，结果可随时复算。
   */
  static computeLeaveEntriesForYear(
    policy: PersonnelLeavePolicy,
    year: number,
    today: Date = new Date(),
    anchorOverride?: string,
    futureOnly = false,
  ): PersonnelLeaveEntry[] {
    const { workDays, leaveDays, cycleStartDate, personnelId } = policy
    const cycleDays = workDays + leaveDays
    const msPerDay = 24 * 60 * 60 * 1000

    const yearStart = new Date(year, 0, 1)
    const yearEnd = new Date(year, 11, 31)

    let cursor: Date
    if (anchorOverride) {
      // 锚点 = 最后实际休假记录的 startDate
      // 下一周期的 cursor = anchor + leaveDays
      const anchorDate = new Date(anchorOverride)
      cursor = new Date(anchorDate.getTime() + leaveDays * msPerDay)
    } else {
      const cycleStart = new Date(cycleStartDate)
      // 回退两个周期，确保捕获跨年边界附近的休假段
      cursor = new Date(cycleStart.getTime() - 2 * cycleDays * msPerDay)
    }

    const entries: PersonnelLeaveEntry[] = []
    let seq = 1

    // 最多迭代到 year+1 年底（覆盖跨年）
    const searchEnd = new Date(year + 1, 11, 31)
    while (cursor.getTime() <= searchEnd.getTime()) {
      const leaveStart = new Date(cursor.getTime() + workDays * msPerDay)
      const leaveEnd = new Date(leaveStart.getTime() + (leaveDays - 1) * msPerDay)

      // futureOnly 模式：跳过已结束的条目
      if (futureOnly && leaveEnd < today) {
        cursor = new Date(cursor.getTime() + cycleDays * msPerDay)
        continue
      }

      if (leaveEnd >= yearStart && leaveStart <= yearEnd) {
        const status: LeaveEntryStatus =
          leaveEnd < today ? 'completed'
          : leaveStart > today ? 'planned'
          : 'active'

        entries.push({
          id: `${personnelId}_REG_${seq}`,
          personnelId,
          type: 'regular',
          startDate: leaveStart.toISOString().slice(0, 10),
          endDate: leaveEnd.toISOString().slice(0, 10),
          plannedDays: leaveDays,
          actualDays: status === 'completed' ? leaveDays : undefined,
          status,
          createdAt: '',
        })
        seq += 1
      }

      cursor = new Date(cursor.getTime() + cycleDays * msPerDay)
    }

    return entries
  }

  /** 聚合所有策略在某年的休假段（去重排序） */
  static buildAllEntries(
    policies: PersonnelLeavePolicy[],
    year: number,
    today: Date = new Date(),
    lastEntryMap?: Map<string, string>,
  ): PersonnelLeaveEntry[] {
    const all: PersonnelLeaveEntry[] = []
    for (const policy of policies) {
      const anchor = lastEntryMap?.get(policy.personnelId)
      const entries = PersonnelLeaveForm.computeLeaveEntriesForYear(
        policy, year, today,
        anchor,
        !!anchor,
      )
      all.push(...entries)
    }
    return all.sort((a, b) => a.startDate.localeCompare(b.startDate))
  }

  // ── 向后兼容：保留 clone / 静态默认值 ──

  /** @deprecated 使用 generatePolicies() 代替 */
  static buildDefaultPolicies(): PersonnelLeavePolicy[] {
    return PersonnelLeaveForm.generatePolicies(
      Array.from({ length: 17 }, (_, i) => ({
        id: `PER${String(i + 1).padStart(3, '0')}`,
      })),
    )
  }

  /** @deprecated 使用 generatePolicies() 生成，不再依赖此静态属性 */
  static readonly DEFAULT_POLICIES: PersonnelLeavePolicy[] =
    PersonnelLeaveForm.buildDefaultPolicies()

  /** @deprecated 无对应后端，不再预置 */
  static readonly DEFAULT_REVISIONS: PersonnelLeavePolicyRevision[] = []

  /** @deprecated 使用 buildAllEntries() 代替 */
  static buildDefaultEntries(): PersonnelLeaveEntry[] {
    return PersonnelLeaveForm.buildAllEntries(
      PersonnelLeaveForm.DEFAULT_POLICIES,
      new Date().getFullYear(),
    )
  }

  /** @deprecated 使用 buildAllEntries() 按需计算，不再依赖此静态属性 */
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
    teams: readonly { label: string; value: string }[] = [],
  ): TeamGroupItem[] {
    const personnelIds = personnelList.map((item) => item.id)

    return teams
      .map((team) => ({
        team: team.value,
        members: personnelList
          .filter((item) => item.team === team.value)
          .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
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
