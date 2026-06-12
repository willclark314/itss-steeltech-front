import { request } from './request'
import type {
  CancelScope,
  ContactRecord,
  ContactRelationType,
  ContactStatus,
  PdfUploadPayload,
  ProjectMode,
} from '@/models/biz/contact'

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

export interface CreateContactPayload {
  title: string
  receivedDate: string
  urgency?: string
  content?: string
  expectReplyDate?: string
  projectNos?: string[]
  primaryPdf?: PdfUploadPayload
  supplementFiles?: PdfUploadPayload[]
}

export interface UpdateContactPayload {
  title?: string
  receivedDate?: string
  urgency?: string
  content?: string
  expectReplyDate?: string
  status?: ContactStatus
  projectNos?: string[]
}

export interface CreateChildContactPayload {
  title: string
  receivedDate: string
  urgency?: string
  content?: string
  relationType: ContactRelationType
  projectMode?: ProjectMode
  projectNos?: string[]
  cancelScope?: CancelScope
  cancelledProjectNos?: string[]
  primaryPdf?: PdfUploadPayload
  supplementFiles?: PdfUploadPayload[]
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

export function fetchContact(id: string) {
  return request<ContactRecord>(`/contacts/${encodeURIComponent(id)}`)
}

export function createContact(payload: CreateContactPayload) {
  return request<ContactRecord>('/contacts', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateContact(id: string, payload: UpdateContactPayload) {
  return request<ContactRecord>(`/contacts/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deleteContact(id: string) {
  return request<{ ok: boolean }>(`/contacts/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export function appendContactAttachments(id: string, files: PdfUploadPayload[]) {
  return request<ContactRecord>(`/contacts/${encodeURIComponent(id)}/attachments`, {
    method: 'POST',
    body: JSON.stringify({ files }),
  })
}

export function createChildContact(parentId: string, payload: CreateChildContactPayload) {
  return request<ContactRecord>(`/contacts/${encodeURIComponent(parentId)}/children`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}
