import { request } from './request'

export interface TempTaskRecord {
  id: string
  name: string
  description: string
  startTime: string
  completedAt: string
  isRelatedProject: boolean
  relatedProjectNo: string
  createdBy: string
  createdByName: string
  personnelIds: string[]
  personnelNames: string[]
  createdAt: string
  updatedAt: string
}

export interface TempTaskPayload {
  name: string
  description?: string
  startTime?: string
  completedAt?: string
  personnelIds?: string[]
  isRelatedProject?: boolean
  relatedProjectNo?: string
}

export interface TempTaskQuery {
  personnelId: string
}

export function fetchTempTaskList(params: TempTaskQuery) {
  const query = new URLSearchParams()
  query.set('personnelId', params.personnelId)
  return request<TempTaskRecord[]>(`/temp-tasks?${query.toString()}`)
}

export function createTempTask(data: TempTaskPayload) {
  return request<TempTaskRecord>('/temp-tasks', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function updateTempTask(id: string, data: TempTaskPayload) {
  return request<TempTaskRecord>(`/temp-tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export function deleteTempTask(id: string) {
  return request<{ id: string }>(`/temp-tasks/${id}`, {
    method: 'DELETE',
  })
}
