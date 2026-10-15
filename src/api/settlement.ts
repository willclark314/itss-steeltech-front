import { request } from './request'
import type {
  SettlementCategory,
  SettlementPendingItem,
  SettlementPricingRecord,
  SettlementRecord,
} from '@/models/biz/settlement/SettlementRecordForm'

export interface SettlementQuery {
  year?: number
  month?: number
  category?: SettlementCategory
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export function fetchSettlementRecordList(params: SettlementQuery = {}) {
  const query = new URLSearchParams()
  if (params.year != null) query.set('year', String(params.year))
  if (params.month != null) query.set('month', String(params.month))
  if (params.category) query.set('category', params.category)
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return request<SettlementRecord[]>(`/settlement/records${suffix}`)
}

export function batchSaveSettlementRecords(records: SettlementRecord[]) {
  return request<SettlementRecord[]>('/settlement/records/batch', {
    method: 'POST',
    body: JSON.stringify(records),
  })
}

export function fetchSettlementPendingList(category?: SettlementCategory) {
  const query = category ? `?category=${category}` : ''
  return request<SettlementPendingItem[]>(`/settlement/pending${query}`)
}

export function batchSaveSettlementPendingItems(records: SettlementPendingItem[]) {
  return request<SettlementPendingItem[]>('/settlement/pending/batch', {
    method: 'POST',
    body: JSON.stringify(records),
  })
}

export function attachPendingItemsToMonth(params: {
  year: number
  month: number
  category: SettlementCategory
  pendingIds?: string[]
}) {
  return request<SettlementRecord[]>(
    '/settlement/pending/attach-to-month',
    {
      method: 'POST',
      body: JSON.stringify(params),
    },
  )
}

export function moveMonthRecordsToPending(params: {
  year: number
  month: number
  category: SettlementCategory
  recordIds?: string[]
}) {
  return request<SettlementPendingItem[]>(
    '/settlement/records/move-to-pending',
    {
      method: 'POST',
      body: JSON.stringify({
        year: params.year,
        month: params.month,
        category: params.category,
        recordIds: params.recordIds,
      }),
    },
  )
}

export function fetchSettlementPricingList(category?: SettlementCategory) {
  const query = category ? `?category=${category}` : ''
  return request<SettlementPricingRecord[]>(`/settlement/pricing${query}`)
}

export function lookupSettlementPricing(category: SettlementCategory, pricingCode: string) {
  const query = new URLSearchParams({ category, pricingCode })
  return request<SettlementPricingRecord>(`/settlement/pricing/lookup?${query.toString()}`)
}

export async function downloadSettlementRecordsExcel(
  year: number,
  month: number,
  category: SettlementCategory,
): Promise<void> {
  const token = localStorage.getItem('itss_token')
  const response = await fetch(
    `${BASE_URL}/settlement/records/export?year=${year}&month=${month}&category=${category}`,
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
      // ignore
    }
    throw new Error(message)
  }

  const disposition = response.headers.get('Content-Disposition')
  const label = category === 'detail' ? '细化' : '设计'
  let filename = `钢结构技术科${year}年${month}月${label}结算.xlsx`
  if (disposition) {
    const match = disposition.match(/filename\*?=(?:UTF-8'')?(.+)/i)
    if (match?.[1]) filename = decodeURIComponent(match[1])
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

export async function importSettlementRecordsExcel(
  file: File,
  year?: number,
  month?: number,
  category?: SettlementCategory,
): Promise<SettlementRecord[]> {
  const token = localStorage.getItem('itss_token')
  const formData = new FormData()
  formData.append('file', file)
  if (year != null) formData.append('year', String(year))
  if (month != null) formData.append('month', String(month))
  if (category) formData.append('category', category)

  const response = await fetch(`${BASE_URL}/settlement/records/import`, {
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
      // ignore
    }
    throw new Error(message)
  }

  return response.json() as Promise<SettlementRecord[]>
}

export async function importSettlementPricingExcel(file: File): Promise<SettlementPricingRecord[]> {
  const token = localStorage.getItem('itss_token')
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${BASE_URL}/settlement/pricing/import`, {
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
      // ignore
    }
    throw new Error(message)
  }

  return response.json() as Promise<SettlementPricingRecord[]>
}
