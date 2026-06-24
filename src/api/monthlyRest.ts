import { request } from './request'
import type { MonthlyRestRecord } from '@/models/personnel/MonthlyRestPlan'

export interface MonthlyRestQuery {
  year?: number
  month?: number
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

/** 获取指定年月的所有月休记录 */
export function fetchMonthlyRestList(params: MonthlyRestQuery = {}) {
  const query = new URLSearchParams()
  if (params.year != null) query.set('year', String(params.year))
  if (params.month != null) query.set('month', String(params.month))
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return request<MonthlyRestRecord[]>(`/monthly-rest${suffix}`)
}

/** 保存（创建或更新）一条月休记录 */
export function saveMonthlyRest(data: MonthlyRestRecord) {
  return request<MonthlyRestRecord>('/monthly-rest', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/** 批量保存月休记录 */
export function batchSaveMonthlyRest(records: MonthlyRestRecord[]) {
  return request<MonthlyRestRecord[]>('/monthly-rest/batch', {
    method: 'POST',
    body: JSON.stringify(records),
  })
}

/** 删除某条月休记录 */
export function deleteMonthlyRest(id: string) {
  return request<{ id: string }>(`/monthly-rest/${id}`, {
    method: 'DELETE',
  })
}

/** 导出月休计划 Excel（仅管理员可用），触发浏览器下载 */
export async function downloadMonthlyRestExcel(year: number, month: number): Promise<void> {
  const token = localStorage.getItem('itss_token')
  const response = await fetch(
    `${BASE_URL}/monthly-rest/export?year=${year}&month=${month}`,
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

  // 从 Content-Disposition 提取文件名，或使用默认名
  const disposition = response.headers.get('Content-Disposition')
  let filename = `${year}年${month}月调休汇总表（钢结构技术科）.xlsx`
  if (disposition) {
    const match = disposition.match(/filename\*?=(?:UTF-8'')?(.+)/i)
    if (match?.[1]) {
      filename = decodeURIComponent(match[1])
    }
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}