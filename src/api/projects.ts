import { request } from './request'
import { ProjectForm } from '@/models/biz/project'
import type { DetailWorkflowEditForm, ProjectNatureCode, ProjectRecord, ProjectStatus } from '@/models/biz/project'
import type { DesignWorkflowEditForm } from '@/models/biz/project/DesignWorkflowForm'

export interface ProjectQuery {
  keyword?: string
  status?: string
  assignedPersonnelId?: string
  tags?: string[]
  flowFilters?: string[]
  natures?: string[]
  personnelTeam?: string
  excludeProjectNos?: string[]
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
  drawingIssueEnabled?: boolean
  drawingIssueYearMonth?: string
  structureType?: string
  estimatedWeightTons?: number | null
}

export interface UpdateProjectPayload {
  projectNo?: string
  name?: string
  customer?: string
  status?: ProjectStatus
  designCompleted?: boolean
  detailCompleted?: boolean
  natures?: ProjectNatureCode[]
  tagIds?: string[]
  assignedPersonnelIds?: string[]
  contactFormIds?: string[]
  plannedStartDate?: string
  plannedEndDate?: string
  actualStartDate?: string
  actualEndDate?: string
  designWorkPath?: string
  detailWorkPath?: string
  localWorkPath?: string
  drawingIssueEnabled?: boolean
  drawingIssueYearMonth?: string
  structureType?: string
  estimatedWeightTons?: number | null
}

export type CopyProjectPayload = UpdateProjectPayload & {
  clearActualDates?: boolean
}

export interface SplitProjectResult {
  original: ProjectRecord
  clone: ProjectRecord
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
  if (params.flowFilters?.length) query.set('flowFilters', params.flowFilters.join(','))
  if (params.natures?.length) query.set('natures', params.natures.join(','))
  if (params.personnelTeam) query.set('personnelTeam', params.personnelTeam)
  if (params.excludeProjectNos?.length) {
    query.set('excludeProjectNos', params.excludeProjectNos.join(','))
  }
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

export function copyProject(sourceNo: string, payload: CopyProjectPayload = {}) {
  return request<ProjectRecord>(`/projects/${encodeURIComponent(sourceNo)}/copy`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }).then(normalizeProjectRecord)
}

export function splitProject(sourceNo: string) {
  return request<SplitProjectResult>(`/projects/${encodeURIComponent(sourceNo)}/split`, {
    method: 'POST',
    body: JSON.stringify({}),
  }).then((result) => ({
    original: normalizeProjectRecord(result.original),
    clone: normalizeProjectRecord(result.clone),
  }))
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

export function saveDesignWorkflow(projectNo: string, payload: DesignWorkflowEditForm) {
  return request<ProjectRecord>(`/projects/${encodeURIComponent(projectNo)}/design-workflow`, {
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

export function saveDesignArea(projectNo: string, designAreaSqm: number | null) {
  return request<ProjectRecord>(
    `/projects/${encodeURIComponent(projectNo)}/design-workflow/design-area`,
    {
      method: 'PUT',
      body: JSON.stringify({ designAreaSqm }),
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
