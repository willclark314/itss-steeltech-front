import { request } from './request'

export interface DetailTeamMemberOrderResult {
  personnelIds: string[]
}

export function fetchDetailTeamMemberOrder() {
  return request<DetailTeamMemberOrderResult>('/detail-team-schedule/member-order')
}

export function saveDetailTeamMemberOrder(personnelIds: string[]) {
  return request<DetailTeamMemberOrderResult>('/detail-team-schedule/member-order', {
    method: 'PUT',
    body: JSON.stringify({ personnelIds }),
  })
}
