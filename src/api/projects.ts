import { request } from './request'
import type { ProjectNatureCode, ProjectRecord, ProjectStatus } from '@/models/biz/project'

export interface ProjectQuery {
  keyword?: string
  status?: string
  page?: number
  pageSize?: number
  anchor?: string
  all?: boolean
}

export interface ProjectListResult {
  list: ProjectRecord[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface CreateProjectPayload {
  projectNo: string
  name?: string
  customer?: string
  status?: ProjectStatus
  natures?: ProjectNatureCode[]
  assignedPersonnelIds?: string[]
  plannedStartDate?: string
  plannedEndDate?: string
  actualStartDate?: string
  actualEndDate?: string
  localWorkPath?: string
  contactFormId?: string
}

export interface UpdateProjectPayload {
  name?: string
  customer?: string
  status?: ProjectStatus
  natures?: ProjectNatureCode[]
  assignedPersonnelIds?: string[]
  plannedStartDate?: string
  plannedEndDate?: string
  actualStartDate?: string
  actualEndDate?: string
  localWorkPath?: string
}

function buildProjectQuery(params: ProjectQuery) {
  const query = new URLSearchParams()
  if (params.keyword) query.set('keyword', params.keyword)
  if (params.status) query.set('status', params.status)
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))
  if (params.anchor) query.set('anchor', params.anchor)
  if (params.all) query.set('all', 'true')
  return query
}

export function fetchProjectList(params: ProjectQuery = {}) {
  const suffix = buildProjectQuery(params).toString()
  return request<ProjectListResult>(`/projects${suffix ? `?${suffix}` : ''}`)
}

export function checkProjectNos(projectNos: string[]) {
  const unique = [...new Set(projectNos.map((item) => item.trim()).filter(Boolean))]
  if (!unique.length) {
    return Promise.resolve({ existing: [] as string[] })
  }
  const query = new URLSearchParams({ nos: unique.join(',') })
  return request<{ existing: string[] }>(`/projects/check?${query.toString()}`)
}

export function createProject(payload: CreateProjectPayload) {
  return request<ProjectRecord>('/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateProject(projectNo: string, payload: UpdateProjectPayload) {
  return request<ProjectRecord>(`/projects/${encodeURIComponent(projectNo)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}
