import { request } from './request'
import type {
  ProjectModelFormState,
  ProjectModelRecord,
  ProjectModelStatus,
  ProjectModelType,
} from '@/models/biz/projectModel/ProjectModelForm'

export interface ProjectModelQuery {
  keyword?: string
  modelType?: ProjectModelType | ''
  status?: ProjectModelStatus | ''
  projectNo?: string
  page?: number
  pageSize?: number
}

export interface ProjectModelListResult {
  list: ProjectModelRecord[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export type ProjectModelPayload = ProjectModelFormState

export function fetchProjectModelList(params: ProjectModelQuery = {}) {
  const query = new URLSearchParams()
  if (params.keyword) query.set('keyword', params.keyword)
  if (params.modelType) query.set('modelType', params.modelType)
  if (params.status) query.set('status', params.status)
  if (params.projectNo) query.set('projectNo', params.projectNo)
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return request<ProjectModelListResult>(`/project-models${suffix}`)
}

export function fetchProjectModel(id: string) {
  return request<ProjectModelRecord>(`/project-models/${id}`)
}

export function createProjectModel(payload: ProjectModelPayload) {
  return request<ProjectModelRecord>('/project-models', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateProjectModel(id: string, payload: Partial<ProjectModelPayload>) {
  return request<ProjectModelRecord>(`/project-models/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deleteProjectModel(id: string) {
  return request<{ ok: boolean }>(`/project-models/${id}`, {
    method: 'DELETE',
  })
}
