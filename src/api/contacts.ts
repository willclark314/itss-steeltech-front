import { request } from './request'
import type {
  CancelScope,
  ContactRecord,
  ContactRelationType,
  PdfUploadPayload,
  ProjectMode,
} from '@/models/biz/contact'

export interface ContactQuery {
  keyword?: string
  assignedPersonnelId?: string
  tags?: string[]
  page?: number
  pageSize?: number
  anchor?: string
  all?: boolean
}

export interface ContactListResult {
  list: ContactRecord[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface CreateContactPayload {
  id?: string
  title: string
  receivedDate: string
  urgency?: string
  content?: string
  expectReplyDate?: string
  projectNos?: string[]
  tagIds?: string[]
  primaryPdf?: PdfUploadPayload
  supplementFiles?: PdfUploadPayload[]
}

export interface UpdateContactPayload {
  id?: string
  title?: string
  createdAt?: string
  receivedDate?: string
  urgency?: string
  content?: string
  expectReplyDate?: string
  relationType?: ContactRelationType
  parentId?: string | null
  projectNos?: string[]
  tagIds?: string[]
  primaryPdf?: PdfUploadPayload
  supplementFiles?: PdfUploadPayload[]
  removedAttachmentIds?: string[]
}

export interface CreateChildContactPayload {
  id?: string
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

export interface ContactPdfMd5CheckResult {
  exists: boolean
  fileMd5?: string
  fileSize?: number
  filePath?: string
}

export function checkContactPdfMd5(md5: string) {
  return request<ContactPdfMd5CheckResult>('/contacts/pdfs/check', {
    method: 'POST',
    body: JSON.stringify({ md5 }),
  })
}

export function fetchContactList(params: ContactQuery = {}) {
  const query = new URLSearchParams()
  if (params.keyword) query.set('keyword', params.keyword)
  if (params.assignedPersonnelId) query.set('assignedPersonnelId', params.assignedPersonnelId)
  if (params.tags?.length) query.set('tags', params.tags.join(','))
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))
  if (params.anchor) query.set('anchor', params.anchor)
  if (params.all) query.set('all', 'true')
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
