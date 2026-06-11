import { request } from './request'
import type { PermissionRecord, RoleRecord, RoleStatus } from '@/models/personnel/RoleForm'

export interface RoleQuery {
  keyword?: string
  status?: string
}

export interface CreateRolePayload {
  id?: string
  name: string
  code: string
  description?: string
  status?: RoleStatus
  permissionIds?: string[]
  assignedPersonnelIds?: string[]
}

export interface UpdateRolePayload {
  name?: string
  code?: string
  description?: string
  status?: RoleStatus
  permissionIds?: string[]
  assignedPersonnelIds?: string[]
}

export function fetchPermissionList() {
  return request<PermissionRecord[]>('/permissions')
}

export function fetchRoleList(params: RoleQuery = {}) {
  const query = new URLSearchParams()
  if (params.keyword) query.set('keyword', params.keyword)
  if (params.status) query.set('status', params.status)
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return request<RoleRecord[]>(`/roles${suffix}`)
}

export function createRole(payload: CreateRolePayload) {
  return request<RoleRecord>('/roles', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateRole(id: string, payload: UpdateRolePayload) {
  return request<RoleRecord>(`/roles/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deleteRole(id: string) {
  return request<{ id: string }>(`/roles/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}
