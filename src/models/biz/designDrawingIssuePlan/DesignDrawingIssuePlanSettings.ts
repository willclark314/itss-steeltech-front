/** 发图计划页面显示配置 */
export interface DesignDrawingIssuePlanPageSettings {
  /** 计划发图日前多少天起显示「临近未发」，0 表示仅当天 */
  approachingDays: number
}

const STORAGE_KEY = 'itss_design_drawing_issue_plan_settings'

export class DesignDrawingIssuePlanSettings {
  static readonly MIN_APPROACHING_DAYS = 0
  static readonly MAX_APPROACHING_DAYS = 30

  static createDefault(): DesignDrawingIssuePlanPageSettings {
    return { approachingDays: 7 }
  }

  static normalize(
    settings: Partial<DesignDrawingIssuePlanPageSettings> | null | undefined,
  ): DesignDrawingIssuePlanPageSettings {
    const days = Number(settings?.approachingDays ?? 7)
    return {
      approachingDays: Number.isFinite(days)
        ? Math.min(
            DesignDrawingIssuePlanSettings.MAX_APPROACHING_DAYS,
            Math.max(DesignDrawingIssuePlanSettings.MIN_APPROACHING_DAYS, Math.round(days)),
          )
        : 7,
    }
  }

  static loadLocal(): DesignDrawingIssuePlanPageSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return DesignDrawingIssuePlanSettings.createDefault()
      return DesignDrawingIssuePlanSettings.normalize(JSON.parse(raw) as DesignDrawingIssuePlanPageSettings)
    } catch {
      return DesignDrawingIssuePlanSettings.createDefault()
    }
  }

  /** @deprecated 使用 loadRemote */
  static load(): DesignDrawingIssuePlanPageSettings {
    return DesignDrawingIssuePlanSettings.loadLocal()
  }

  static saveLocal(settings: DesignDrawingIssuePlanPageSettings) {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(DesignDrawingIssuePlanSettings.normalize(settings)),
    )
  }

  /** @deprecated 配置已改为服务端共享，请使用 saveRemote */
  static save(settings: DesignDrawingIssuePlanPageSettings) {
    DesignDrawingIssuePlanSettings.saveLocal(settings)
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
