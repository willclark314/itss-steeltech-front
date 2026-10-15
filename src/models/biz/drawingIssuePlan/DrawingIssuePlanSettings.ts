/** 发图计划页面显示配置 */
export interface DrawingIssuePlanPageSettings {
  /** 计划发图日前多少天起显示「临近未发」，0 表示仅当天 */
  approachingDays: number
}

const STORAGE_KEY = 'itss_drawing_issue_plan_settings'

export class DrawingIssuePlanSettings {
  static readonly MIN_APPROACHING_DAYS = 0
  static readonly MAX_APPROACHING_DAYS = 30

  static createDefault(): DrawingIssuePlanPageSettings {
    return { approachingDays: 7 }
  }

  static normalize(
    settings: Partial<DrawingIssuePlanPageSettings> | null | undefined,
  ): DrawingIssuePlanPageSettings {
    const days = Number(settings?.approachingDays ?? 7)
    return {
      approachingDays: Number.isFinite(days)
        ? Math.min(
            DrawingIssuePlanSettings.MAX_APPROACHING_DAYS,
            Math.max(DrawingIssuePlanSettings.MIN_APPROACHING_DAYS, Math.round(days)),
          )
        : 7,
    }
  }

  static loadLocal(): DrawingIssuePlanPageSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return DrawingIssuePlanSettings.createDefault()
      return DrawingIssuePlanSettings.normalize(JSON.parse(raw) as DrawingIssuePlanPageSettings)
    } catch {
      return DrawingIssuePlanSettings.createDefault()
    }
  }

  /** @deprecated 使用 loadRemote */
  static load(): DrawingIssuePlanPageSettings {
    return DrawingIssuePlanSettings.loadLocal()
  }

  static saveLocal(settings: DrawingIssuePlanPageSettings) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(DrawingIssuePlanSettings.normalize(settings)),
    )
  }

  /** @deprecated 配置已改为服务端共享，请使用 saveRemote */
  static save(settings: DrawingIssuePlanPageSettings) {
    DrawingIssuePlanSettings.saveLocal(settings)
  }

  static formatApproachingLegend(days: number): string {
    if (days <= 0) return '临近未发（当天）'
    return `临近未发（前${days}天）`
  }

  static formatApproachingHint(days: number): string {
    if (days <= 0) return '在计划发图当天显示「临近未发」提示'
    return `在计划发图前 ${days} 天至当天显示「临近未发」提示`
  }
}
