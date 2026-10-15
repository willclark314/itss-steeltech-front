import { request } from './request'

export interface DesignTeamMemberOrderResult {
  personnelIds: string[]
}

export function fetchDesignTeamMemberOrder() {
  return request<DesignTeamMemberOrderResult>('/design-team-schedule/member-order')
}

export function saveDesignTeamMemberOrder(personnelIds: string[]) {
  return request<DesignTeamMemberOrderResult>('/design-team-schedule/member-order', {
    method: 'PUT',
    body: JSON.stringify({ personnelIds }),
  })
}
