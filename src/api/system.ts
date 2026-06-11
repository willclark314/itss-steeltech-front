import { request } from './request'
import type { LocalWorkPathConfig } from '@/models/biz'

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
