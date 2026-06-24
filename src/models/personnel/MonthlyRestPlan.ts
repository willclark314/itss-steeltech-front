import type { PersonnelRecord } from './PersonnelForm'

/** 单条月休记录 */
export interface MonthlyRestRecord {
  id: string
  personnelId: string
  year: number
  /** 1-12 */
  month: number
  /** ISO 日期字符串数组，如 ["2026-06-07", "2026-06-14"]，仅限周六/周日 */
  restDays: string[]
}

/** 月休表格行（用于列表展示） */
export interface MonthlyRestTableRow {
  personnelId: string
  employeeName: string
  employeeNo: string
  team: string
  position: string
  restDays: Set<string>
}

/** 周末日信息 */
export interface WeekendDay {
  date: string
  day: number
  weekday: string
  weekLabel: string
}

/** 按班组分组 */
export interface MonthlyRestTeamGroup {
  team: string
  members: MonthlyRestTableRow[]
}

export class MonthlyRestForm {
  /** 获取指定年月的所有日期（1号到最后一天） */
  static getAllDaysOfMonth(year: number, month: number): WeekendDay[] {
    const days: WeekendDay[] = []
    const daysInMonth = new Date(year, month, 0).getDate()
    const weekLabels = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day)
      const dayOfWeek = date.getDay()
      const weekOfMonth = Math.ceil(day / 7)
      days.push({
        date: MonthlyRestForm.formatDate(date),
        day,
        weekday: weekLabels[dayOfWeek],
        weekLabel: `第${weekOfMonth}周`,
      })
    }

    return days
  }

  /** 获取指定年月的所有周六和周日 */
  static getWeekendsOfMonth(year: number, month: number): WeekendDay[] {
    const weekends: WeekendDay[] = []
    const daysInMonth = new Date(year, month, 0).getDate()

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month - 1, day)
      const dayOfWeek = date.getDay() // 0=周日, 6=周六

      if (dayOfWeek === 0 || dayOfWeek === 6) {
        const weekOfMonth = Math.ceil(day / 7)
        weekends.push({
          date: MonthlyRestForm.formatDate(date),
          day,
          weekday: dayOfWeek === 6 ? '周六' : '周日',
          weekLabel: `第${weekOfMonth}周`,
        })
      }
    }

    return weekends
  }

  /** 判断指定日期是否为周末 */
  static isWeekend(dateStr: string): boolean {
    const date = new Date(dateStr)
    const day = date.getDay()
    return day === 0 || day === 6
  }

  /** 格式化日期为 ISO 字符串 */
  static formatDate(date: Date): string {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  /** 格式化日期为中文显示 */
  static formatDateCN(dateStr: string): string {
    const date = new Date(dateStr)
    const m = date.getMonth() + 1
    const d = date.getDate()
    const dayOfWeek = date.getDay()
    const weekLabel = dayOfWeek === 6 ? '周六' : '周日'
    return `${m}月${d}日 ${weekLabel}`
  }

  /** 获取当前年份 */
  static getCurrentYear(): number {
    return new Date().getFullYear()
  }

  /** 获取当前月份 */
  static getCurrentMonth(): number {
    return new Date().getMonth() + 1
  }

  /** 构建表格行数据 */
  static buildTableRows(
    personnelList: PersonnelRecord[],
    restRecords: MonthlyRestRecord[],
    year: number,
    month: number,
  ): MonthlyRestTableRow[] {
    const recordMap = new Map<string, Set<string>>()
    for (const record of restRecords) {
      if (record.year === year && record.month === month) {
        recordMap.set(record.personnelId, new Set(record.restDays))
      }
    }

    return personnelList
      .filter((p) => p.status === 'active')
      .map((p) => ({
        personnelId: p.id,
        employeeName: p.name,
        employeeNo: p.employeeNo,
        team: p.team,
        position: p.position,
        restDays: recordMap.get(p.id) ?? new Set<string>(),
      }))
  }

  /** 按班组分组 */
  static buildTeamGroups(
    rows: MonthlyRestTableRow[],
    teamOptions: readonly { label: string; value: string }[],
  ): MonthlyRestTeamGroup[] {
    return teamOptions
      .map((opt) => ({
        team: opt.value,
        members: rows
          .filter((row) => row.team === opt.value)
          .sort((a, b) => a.employeeName.localeCompare(b.employeeName, 'zh-CN')),
      }))
      .filter((group) => group.members.length > 0)
  }

  /** 切换某个人员某个日期的休息状态，返回是否设置为休息 */
  static toggleRestDay(row: MonthlyRestTableRow, dateStr: string): boolean {
    if (!MonthlyRestForm.isWeekend(dateStr)) return false

    if (row.restDays.has(dateStr)) {
      row.restDays.delete(dateStr)
      return false
    } else {
      row.restDays.add(dateStr)
      return true
    }
  }

  /** 从表格行构建保存用的记录 */
  static buildSaveRecord(
    row: MonthlyRestTableRow,
    year: number,
    month: number,
    existingId?: string,
  ): MonthlyRestRecord {
    return {
      id: existingId ?? `${row.personnelId}_${year}_${String(month).padStart(2, '0')}`,
      personnelId: row.personnelId,
      year,
      month,
      restDays: Array.from(row.restDays).sort(),
    }
  }

  /** 生成默认月休记录（示例数据） */
  static generateDefaultRecords(personnelList: PersonnelRecord[]): MonthlyRestRecord[] {
    const now = new Date()
    const year = now.getFullYear()
    const month = now.getMonth() + 1
    const weekends = MonthlyRestForm.getWeekendsOfMonth(year, month)

    return personnelList
      .filter((p) => p.status === 'active')
      .map((p, index) => {
        const count = (index % 3) + 1
        const selected = weekends
          .filter((_, wi) => wi % personnelList.length === index % weekends.length)
          .slice(0, count)
          .map((w) => w.date)

        return {
          id: `${p.id}_${year}_${String(month).padStart(2, '0')}`,
          personnelId: p.id,
          year,
          month,
          restDays: selected,
        }
      })
  }
}