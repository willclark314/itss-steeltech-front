import { request } from './request'
import type { PersonnelRecord } from '@/models/personnel'

export interface PersonnelQuery {
  keyword?: string
  status?: string
}

export function fetchPersonnelList(params: PersonnelQuery = {}) {
  const query = new URLSearchParams()
  if (params.keyword) query.set('keyword', params.keyword)
  if (params.status) query.set('status', params.status)
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return request<PersonnelRecord[]>(`/personnel${suffix}`)
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
