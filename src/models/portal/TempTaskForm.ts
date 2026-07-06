import type { TempTaskRecord } from '@/api/tempTasks'

export class TempTaskForm {
  static readonly DATETIME_FORMAT = 'YYYY-MM-DD HH:mm:ss'

  static nowDatetime(): string {
    const now = new Date()
    const pad = (value: number) => String(value).padStart(2, '0')
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  }

  static formatDatetime(value: string): string {
    if (!value) return '—'
    return value.slice(0, 16)
  }

  static formatShortDate(value: string): string {
    if (!value) return '—'
    return value.slice(0, 10)
  }

  static sortForDisplay(list: TempTaskRecord[]): TempTaskRecord[] {
    return [...list].sort((left, right) => {
      const startCompare = right.startTime.localeCompare(left.startTime)
      if (startCompare !== 0) return startCompare
      return right.createdAt.localeCompare(left.createdAt)
    })
  }

  static buildCreateDefaults(personnelId: string): {
    name: string
    description: string
    startTime: string
    completedAt: string
    personnelIds: string[]
  } {
    return {
      name: '',
      description: '',
      startTime: TempTaskForm.nowDatetime(),
      completedAt: '',
      personnelIds: personnelId ? [personnelId] : [],
    }
  }
}
