import { request } from './request'

/** 后端 /api/leave/calendar 响应 */
export interface LeaveCalendarResponse {
  year: number
  today: string
  personnel: Array<{
    id: string
    name: string
    employeeNo: string
    team: string
    position: string
    nationality: string
    status: string
  }>
  policies: Array<{
    id: string
    personnelId: string
    workDays: number
    leaveDays: number
    cycleStartDate: string
  }>
  actualEntries: LeaveEntryDTO[]
  computedEntries: LeaveEntryDTO[]
}

/** 后端休假策略 DTO */
export interface LeavePolicyDTO {
  id: string
  personnelId: string
  workDays: number
  leaveDays: number
  cycleStartDate: string
  effectiveFrom?: string | null
  remark?: string | null
  createdAt?: string
  updatedAt?: string
}

/** 后端休假记录 DTO（与 PersonnelLeaveEntry 对齐） */
export interface LeaveEntryDTO {
  id: string
  personnelId: string
  type: 'regular' | 'extended' | 'early'
  startDate: string
  endDate: string
  plannedDays: number
  actualDays?: number | null
  status: 'planned' | 'active' | 'completed' | 'cancelled'
  parentEntryId: string
  reason: string
  remark: string
  createdAt?: string
  updatedAt?: string
  /** 是否为后端计算值（不入库） */
  computed?: boolean
}

/** 当前用户休假数据可见范围（与后端 JWT 权限一致） */
export interface LeaveScope {
  personnelId: string
  role: 'admin' | 'leader' | 'member'
  editablePersonnelIds: string[]
  team: string
}

/** 获取当前用户的休假可见范围 */
export function fetchLeaveScope() {
  return request<LeaveScope>('/leave/my-scope')
}

export interface LeaveCalendarQuery {
  year: number
  /** 非管理员传本人 personnelId，后端会校验与 JWT 一致 */
  personnelId?: string
}

/** 获取年度休假日历（合并实际记录 + 计算值，管理员使用） */
export function fetchLeaveCalendar(params: LeaveCalendarQuery) {
  const query = new URLSearchParams({ year: String(params.year) })
  if (params.personnelId) {
    query.set('personnelId', params.personnelId)
  }
  return request<LeaveCalendarResponse>(`/leave/calendar?${query.toString()}`)
}

/** 普通员工专用：仅返回本人休假日历 */
export function fetchMyLeaveCalendar(year: number) {
  return request<LeaveCalendarResponse>(`/leave/my-calendar?year=${year}`)
}

/** 创建休假记录 */
export function createLeaveEntry(data: Partial<LeaveEntryDTO>) {
  return request<LeaveEntryDTO>('/leave/entries', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/** 更新休假记录 */
export function updateLeaveEntry(id: string, data: Partial<LeaveEntryDTO>) {
  return request<LeaveEntryDTO>(`/leave/entries/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

/** 保存休假记录（自动判断创建或更新） */
export function saveLeaveEntry(data: Partial<LeaveEntryDTO>) {
  if (data.id && !data.computed) {
    return updateLeaveEntry(data.id, data)
  }
  // 新建：去掉 id 和 computed 标记
  const { id: _id, computed: _c, ...rest } = data as LeaveEntryDTO & { computed?: boolean }
  return createLeaveEntry(rest)
}

/** 取消休假记录（软删除） */
export function cancelLeaveEntry(id: string) {
  return request<LeaveEntryDTO>(`/leave/entries/${id}/cancel`, {
    method: 'POST',
  })
}

/** 硬删除休假记录 */
export function deleteLeaveEntry(id: string) {
  return request<{ id: string }>(`/leave/entries/${id}`, {
    method: 'DELETE',
  })
}

// ── 休假策略 CRUD ──

/** 获取所有休假策略 */
export function fetchPolicies() {
  return request<LeavePolicyDTO[]>('/leave/policies')
}

/** 获取单条休假策略 */
export function fetchPolicy(policyId: string) {
  return request<LeavePolicyDTO>(`/leave/policies/${policyId}`)
}

/** 创建或更新休假策略 */
export function savePolicy(data: Partial<LeavePolicyDTO>) {
  if (data.id) {
    return request<LeavePolicyDTO>(`/leave/policies/${data.id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }
  return request<LeavePolicyDTO>('/leave/policies', {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

/** 删除休假策略 */
export function deletePolicy(policyId: string) {
  return request<{ id: string }>(`/leave/policies/${policyId}`, {
    method: 'DELETE',
  })
}
