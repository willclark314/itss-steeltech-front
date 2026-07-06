import { request } from './request'
import type { LocalWorkPathConfig } from '@/models/biz'
import type { ProjectNatureCode } from '@/models/biz/project'

export interface SystemConfigResponse {
  localWorkPath: LocalWorkPathConfig
}

export function fetchSystemConfig() {
  return request<SystemConfigResponse>('/system/config')
}

export function updateSystemConfig(payload: SystemConfigResponse) {
  return request<SystemConfigResponse>('/system/config', {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function checkPathExists(path: string) {
  const query = new URLSearchParams({ path })
  return request<{ path: string; exists: boolean }>(`/system/path-exists?${query.toString()}`)
}

export interface ProjectPathMatch {
  relativePath: string
  fullPath: string
}

export interface SearchProjectPathOptions {
  relativePath?: string
  natures?: ProjectNatureCode[]
  receivedDate?: string
  projectName?: string
  contactFormIds?: string[]
  isJiagongdan?: boolean
}

export function searchProjectPath(projectNo: string, options: SearchProjectPathOptions = {}) {
  const query = new URLSearchParams({ projectNo })
  if (options.relativePath) query.set('relativePath', options.relativePath)
  if (options.natures?.length) query.set('natures', options.natures.join(','))
  if (options.receivedDate) query.set('receivedDate', options.receivedDate)
  if (options.projectName) query.set('projectName', options.projectName)
  if (options.contactFormIds?.length) {
    query.set('contactFormIds', options.contactFormIds.join(','))
  }
  if (options.isJiagongdan !== undefined) {
    query.set('isJiagongdan', options.isJiagongdan ? 'true' : 'false')
  }
  return request<{ projectNo: string; matches: ProjectPathMatch[] }>(
    `/system/search-project-path?${query.toString()}`,
  )
}

export interface HostDriveInfo {
  name: string
  label: string
  type: 'local' | 'share'
  totalBytes?: number
  freeBytes?: number
}

export interface HostDrivesResponse {
  ip: string
  isLocal: boolean
  drives: HostDriveInfo[]
}

export function fetchLocalIps() {
  return request<{ ips: string[] }>('/system/local-ip')
}

export function fetchHostDrives(ip: string) {
  const query = new URLSearchParams({ ip })
  return request<HostDrivesResponse>(`/system/host-drives?${query.toString()}`)
}

export interface FolderTemplateInfo {
  key: ProjectNatureCode
  name: string
  description: string
}

export interface GenerateWorkPathPayload {
  path: string
  template: ProjectNatureCode
  ip?: string
  drive?: string
  variables?: Record<string, string>
  skipExisting?: boolean
}

export interface GenerateWorkPathResult {
  ok: boolean
  template: string
  fullPath: string
  createdDirs: string[]
  skippedDirs: string[]
  createdFiles: string[]
  skippedFiles: string[]
}

export function fetchFolderTemplates() {
  return request<{ templates: FolderTemplateInfo[] }>('/system/folder-templates')
}

export function generateWorkPath(payload: GenerateWorkPathPayload) {
  return request<GenerateWorkPathResult>('/system/generate-work-path', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

