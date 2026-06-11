import { request } from './request'
import type { ContactRecord } from '@/models/biz/contact'

export interface ContactQuery {
  keyword?: string
  status?: string
  page?: number
  pageSize?: number
  anchor?: string
}

export interface ContactListResult {
  list: ContactRecord[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export function fetchContactList(params: ContactQuery = {}) {
  const query = new URLSearchParams()
  if (params.keyword) query.set('keyword', params.keyword)
  if (params.status) query.set('status', params.status)
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))
  if (params.anchor) query.set('anchor', params.anchor)
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return request<ContactListResult>(`/contacts${suffix}`)
}
