import { request } from './request'
import { ProjectForm } from '@/models/biz/project'
import type { DetailWorkflowEditForm, ProjectNatureCode, ProjectRecord, ProjectStatus } from '@/models/biz/project'

export interface ProjectQuery {
  keyword?: string
  status?: string
  assignedPersonnelId?: string
  tags?: string[]
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
  designCompleted?: boolean
  detailCompleted?: boolean
  natures?: ProjectNatureCode[]
  tagIds?: string[]
  assignedPersonnelIds?: string[]
  plannedStartDate?: string
  plannedEndDate?: string
  actualStartDate?: string
  actualEndDate?: string
  designWorkPath?: string
  detailWorkPath?: string
  localWorkPath?: string
  contactFormId?: string
}

export interface UpdateProjectPayload {
  name?: string
  customer?: string
  status?: ProjectStatus
  designCompleted?: boolean
  detailCompleted?: boolean
  natures?: ProjectNatureCode[]
  tagIds?: string[]
  assignedPersonnelIds?: string[]
  plannedStartDate?: string
  plannedEndDate?: string
  actualStartDate?: string
  actualEndDate?: string
  designWorkPath?: string
  detailWorkPath?: string
  localWorkPath?: string
}

function normalizeProjectRecord(record: ProjectRecord): ProjectRecord {
  const baseProjectNo = ProjectForm.getDisplayProjectNo(record)
  return ProjectForm.cloneRecord({
    ...record,
    baseProjectNo,
    relatedProjects: record.relatedProjects || [],
    tags: record.tags || [],
  })
}

function normalizeProjectListResult(result: ProjectListResult): ProjectListResult {
  return {
    ...result,
    list: result.list.map(normalizeProjectRecord),
  }
}

function buildProjectQuery(params: ProjectQuery) {
  const query = new URLSearchParams()
  if (params.keyword) query.set('keyword', params.keyword)
  if (params.status) query.set('status', params.status)
  if (params.assignedPersonnelId) query.set('assignedPersonnelId', params.assignedPersonnelId)
  if (params.tags?.length) query.set('tags', params.tags.join(','))
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))
  if (params.anchor) query.set('anchor', params.anchor)
  if (params.all) query.set('all', 'true')
  return query
}

export function fetchProjectList(params: ProjectQuery = {}) {
  const suffix = buildProjectQuery(params).toString()
  return request<ProjectListResult>(`/projects${suffix ? `?${suffix}` : ''}`).then(
    normalizeProjectListResult,
  )
}

export function checkProjectNos(projectNos: string[]) {
  const unique = [...new Set(projectNos.map((item) => item.trim()).filter(Boolean))]
  if (!unique.length) {
    return Promise.resolve({ existing: [] as string[], exact: [] as string[] })
  }
  const query = new URLSearchParams({ nos: unique.join(',') })
  return request<{ existing: string[]; exact: string[] }>(`/projects/check?${query.toString()}`)
}

export function createProject(payload: CreateProjectPayload) {
  return request<ProjectRecord>('/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  }).then(normalizeProjectRecord)
}

export function updateProject(projectNo: string, payload: UpdateProjectPayload) {
  return request<ProjectRecord>(`/projects/${encodeURIComponent(projectNo)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }).then(normalizeProjectRecord)
}

export function deleteProject(projectNo: string) {
  return request<{ ok: boolean }>(`/projects/${encodeURIComponent(projectNo)}`, {
    method: 'DELETE',
  })
}

export function saveDetailWorkflow(projectNo: string, payload: DetailWorkflowEditForm) {
  return request<ProjectRecord>(`/projects/${encodeURIComponent(projectNo)}/detail-workflow`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  }).then(normalizeProjectRecord)
}

export function saveModelWeight(projectNo: string, modelWeightTons: number | null) {
  return request<ProjectRecord>(
    `/projects/${encodeURIComponent(projectNo)}/detail-workflow/model-weight`,
    {
      method: 'PUT',
      body: JSON.stringify({ modelWeightTons }),
    },
  ).then(normalizeProjectRecord)
}

export function applyDetailWorkflowAction(projectNo: string, action: string) {
  return request<ProjectRecord>(`/projects/${encodeURIComponent(projectNo)}/detail-workflow`, {
    method: 'PATCH',
    body: JSON.stringify({ action }),
  }).then(normalizeProjectRecord)
}

export function leaveProjectAssignment(projectNo: string, personnelId: string) {
  return request<ProjectRecord>(
    `/projects/${encodeURIComponent(projectNo)}/leave-assignment`,
    {
      method: 'POST',
      body: JSON.stringify({ personnelId }),
    },
  ).then(normalizeProjectRecord)
}
