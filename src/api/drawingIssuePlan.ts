import { request } from './request'
import type { DrawingIssuePlanRecord } from '@/models/biz/drawingIssuePlan/DrawingIssuePlanForm'

export interface DrawingIssuePlanQuery {
  year?: number
  month?: number
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export function fetchDrawingIssuePlanList(params: DrawingIssuePlanQuery = {}) {
  const query = new URLSearchParams()
  if (params.year != null) query.set('year', String(params.year))
  if (params.month != null) query.set('month', String(params.month))
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return request<DrawingIssuePlanRecord[]>(`/drawing-issue-plan${suffix}`)
}

export interface DrawingIssuePlanPageSettingsResponse {
  approachingDays: number
}

export function fetchDrawingIssuePlanSettings() {
  return request<DrawingIssuePlanPageSettingsResponse>('/drawing-issue-plan/settings')
}

export function saveDrawingIssuePlanSettings(settings: DrawingIssuePlanPageSettingsResponse) {
  return request<DrawingIssuePlanPageSettingsResponse>('/drawing-issue-plan/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  })
}

export function batchSaveDrawingIssuePlan(records: DrawingIssuePlanRecord[]) {
  return request<DrawingIssuePlanRecord[]>('/drawing-issue-plan/batch', {
    method: 'POST',
    body: JSON.stringify(records),
  })
}

export async function downloadDrawingIssuePlanExcel(year: number, month: number): Promise<void> {
  const token = localStorage.getItem('itss_token')
  const response = await fetch(
    `${BASE_URL}/drawing-issue-plan/export?year=${year}&month=${month}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  )

  if (!response.ok) {
    let message = `导出失败: ${response.status}`
    try {
      const payload = (await response.json()) as { message?: string }
      if (payload.message) message = payload.message
    } catch {
      // ignore parse error
    }
    throw new Error(message)
  }

  const disposition = response.headers.get('Content-Disposition')
  let filename = `设备技术部${year}年${month}月钢构细化发图计划.xlsx`
  if (disposition) {
    const match = disposition.match(/filename\*?=(?:UTF-8'')?(.+)/i)
    if (match?.[1]) {
      filename = decodeURIComponent(match[1])
    }
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

export async function importDrawingIssuePlanExcel(
  file: File,
  year?: number,
  month?: number,
): Promise<DrawingIssuePlanRecord[]> {
  const token = localStorage.getItem('itss_token')
  const formData = new FormData()
  formData.append('file', file)
  if (year != null) formData.append('year', String(year))
  if (month != null) formData.append('month', String(month))

  const response = await fetch(`${BASE_URL}/drawing-issue-plan/import`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  })

  if (!response.ok) {
    let message = `导入失败: ${response.status}`
    try {
      const payload = (await response.json()) as { message?: string }
      if (payload.message) message = payload.message
    } catch {
      // ignore parse error
    }
    throw new Error(message)
  }

  return response.json() as Promise<DrawingIssuePlanRecord[]>
}
