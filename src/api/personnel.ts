import { request } from './request'
import type { PersonnelRecord } from '@/models/personnel'

export interface PersonnelQuery {
  keyword?: string
  status?: string
}

export interface PersonnelImportResult {
  created: number
  updated: number
  skipped: number
  errors: string[]
  message: string
  items: PersonnelRecord[]
}

const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export function fetchPersonnelList(params: PersonnelQuery = {}) {
  const query = new URLSearchParams()
  if (params.keyword) query.set('keyword', params.keyword)
  if (params.status) query.set('status', params.status)
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return request<PersonnelRecord[]>(`/personnel${suffix}`)
}

export function createPersonnel(data: PersonnelRecord) {
  return request<PersonnelRecord>('/personnel', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updatePersonnel(id: string, data: PersonnelRecord) {
  return request<PersonnelRecord>(`/personnel/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deletePersonnel(id: string) {
  return request<{ id: string }>(`/personnel/${id}`, {
    method: 'DELETE',
  })
}

export async function downloadPersonnelCsvTemplate(): Promise<void> {
  const token = localStorage.getItem('itss_token')
  const response = await fetch(`${BASE_URL}/personnel/export-csv`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })

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
  let filename = '人员导入模板.csv'
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

export async function importPersonnelCsv(file: File): Promise<PersonnelImportResult> {
  const token = localStorage.getItem('itss_token')
  const formData = new FormData()
  formData.append('file', file)

  const response = await fetch(`${BASE_URL}/personnel/import-csv`, {
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

  return response.json() as Promise<PersonnelImportResult>
}
