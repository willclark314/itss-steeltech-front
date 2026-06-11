import type { LocationQuery } from 'vue-router'

export interface AppErrorOptions {
  code?: number | string
  title?: string
  message?: string
  detail?: string
  requestId?: string
  path?: string
  timestamp?: string
  [key: string]: unknown
}

export type ErrorRouteQuery = Record<string, string | undefined>

export interface AppErrorField {
  key: string
  label: string
  value: string
}

export class AppError {
  static readonly CORE_FIELDS = [
    'code',
    'title',
    'message',
    'detail',
    'requestId',
    'path',
    'timestamp',
  ] as const

  static readonly FIELD_LABELS: Record<string, string> = {
    code: '错误码',
    title: '标题',
    message: '说明',
    detail: '详细信息',
    requestId: '请求 ID',
    path: '请求路径',
    timestamp: '发生时间',
  }

  readonly code: number
  readonly title: string
  readonly message: string
  readonly detail?: string
  readonly requestId?: string
  readonly path?: string
  readonly timestamp?: string

  private readonly extras: Record<string, unknown>

  constructor(options: AppErrorOptions = {}) {
    this.code = AppError.parseCode(options.code)
    this.title = options.title?.toString() || AppError.defaultTitle(this.code)
    this.message = options.message?.toString() || AppError.defaultMessage(this.code)
    this.detail = options.detail?.toString()
    this.requestId = options.requestId?.toString()
    this.path = options.path?.toString()
    this.timestamp = options.timestamp?.toString()

    this.extras = {}
    for (const [key, value] of Object.entries(options)) {
      if (AppError.isCoreField(key) || value == null || value === '') continue
      this.extras[key] = value
    }
  }

  static from(options: AppErrorOptions = {}): AppError {
    return new AppError(options)
  }

  static fromQuery(query: LocationQuery): AppError {
    const options: AppErrorOptions = {}

    for (const [key, value] of Object.entries(query)) {
      const parsed = AppError.readQueryValue(value)
      if (parsed == null || parsed === '') continue

      if (key === 'extra') {
        try {
          Object.assign(options, JSON.parse(parsed) as Record<string, unknown>)
        } catch {
          options.extra = parsed
        }
        continue
      }

      options[key] = parsed
    }

    return new AppError(options)
  }

  static notFound(message?: string): AppError {
    return new AppError({ code: 404, message })
  }

  static forbidden(message?: string): AppError {
    return new AppError({ code: 403, message })
  }

  static unauthorized(message?: string): AppError {
    return new AppError({ code: 401, message })
  }

  static server(message?: string, detail?: string): AppError {
    return new AppError({ code: 500, message, detail })
  }

  static parseCode(value: unknown): number {
    const code = Number(value)
    return Number.isFinite(code) && code >= 400 ? code : 404
  }

  static defaultTitle(code: number): string {
    if (code === 404) return '页面未找到'
    if (code === 403) return '无访问权限'
    if (code === 401) return '未授权'
    if (code >= 500) return '服务器错误'
    return '出错了'
  }

  static defaultMessage(code: number): string {
    if (code === 404) return '抱歉，您访问的页面不存在或已被移除。'
    if (code === 403) return '抱歉，您没有权限访问此页面。'
    if (code === 401) return '抱歉，请先登录后再访问。'
    if (code >= 500) return '抱歉，系统遇到了一些问题，请稍后再试。'
    return '抱歉，操作未能完成，请稍后再试。'
  }

  static getFieldLabel(key: string): string {
    return AppError.FIELD_LABELS[key] ?? key
  }

  static isCoreField(key: string): boolean {
    return (AppError.CORE_FIELDS as readonly string[]).includes(key)
  }

  private static readQueryValue(value: LocationQuery[string]): string | undefined {
    if (value == null) return undefined
    const raw = Array.isArray(value) ? value[0] : value
    if (raw == null) return undefined
    return String(raw)
  }

  getIcon(): 'warning' | 'error' | 'info' {
    if (this.code === 404) return 'warning'
    if (this.code >= 500) return 'error'
    return 'info'
  }

  getExtraFields(): AppErrorField[] {
    return Object.entries(this.extras).map(([key, value]) => ({
      key,
      label: AppError.getFieldLabel(key),
      value: typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value),
    }))
  }

  getDetailFields(): AppErrorField[] {
    const fields: AppErrorField[] = []

    if (this.detail) {
      fields.push({ key: 'detail', label: AppError.getFieldLabel('detail'), value: this.detail })
    }
    if (this.requestId) {
      fields.push({
        key: 'requestId',
        label: AppError.getFieldLabel('requestId'),
        value: this.requestId,
      })
    }
    if (this.path) {
      fields.push({ key: 'path', label: AppError.getFieldLabel('path'), value: this.path })
    }
    if (this.timestamp) {
      fields.push({
        key: 'timestamp',
        label: AppError.getFieldLabel('timestamp'),
        value: this.timestamp,
      })
    }

    return [...fields, ...this.getExtraFields()]
  }

  toJSON(): AppErrorOptions {
    return {
      code: this.code,
      title: this.title,
      message: this.message,
      detail: this.detail,
      requestId: this.requestId,
      path: this.path,
      timestamp: this.timestamp,
      ...this.extras,
    }
  }

  toRouteQuery(): ErrorRouteQuery {
    const query: ErrorRouteQuery = {}

    for (const [key, value] of Object.entries(this.toJSON())) {
      if (value == null || value === '') continue
      if (typeof value === 'object') {
        query.extra = JSON.stringify(value)
        continue
      }
      query[key] = String(value)
    }

    return query
  }
}
