import { request } from './request'
import type { ChangeOrderRecord, PdfUploadPayload } from '@/models/biz/changeOrder'

export interface ChangeOrderQuery {
  keyword?: string
  page?: number
  pageSize?: number
}

export interface ChangeOrderListResult {
  list: ChangeOrderRecord[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface CreateChangeOrderPayload {
  orderNo?: string
  title: string
  receivedDate: string
  content?: string
  projectNos?: string[]
  primaryFiles?: PdfUploadPayload[]
}

export interface UpdateChangeOrderPayload {
  orderNo?: string
  title?: string
  receivedDate?: string
  content?: string
  projectNos?: string[]
  primaryFiles?: PdfUploadPayload[]
  removedPrimaryIds?: string[]
}

export interface ChangeOrderPdfMd5CheckResult {
  exists: boolean
  fileMd5?: string
  fileSize?: number
  filePath?: string
}

export function checkChangeOrderPdfMd5(md5: string) {
  return request<ChangeOrderPdfMd5CheckResult>('/change-orders/pdfs/check', {
    method: 'POST',
    body: JSON.stringify({ md5 }),
  })
}

export function fetchChangeOrderList(params: ChangeOrderQuery = {}) {
  const query = new URLSearchParams()
  if (params.keyword) query.set('keyword', params.keyword)
  if (params.page) query.set('page', String(params.page))
  if (params.pageSize) query.set('pageSize', String(params.pageSize))
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return request<ChangeOrderListResult>(`/change-orders${suffix}`)
}

export function fetchChangeOrder(id: number) {
  return request<ChangeOrderRecord>(`/change-orders/${id}`)
}

export function createChangeOrder(payload: CreateChangeOrderPayload) {
  return request<ChangeOrderRecord>('/change-orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateChangeOrder(id: number, payload: UpdateChangeOrderPayload) {
  return request<ChangeOrderRecord>(`/change-orders/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deleteChangeOrder(id: number) {
  return request<{ ok: boolean }>(`/change-orders/${id}`, {
    method: 'DELETE',
  })
}

export function appendChangeOrderPrimaryFiles(id: number, files: PdfUploadPayload[]) {
  return request<ChangeOrderRecord>(`/change-orders/${id}/primary-files`, {
    method: 'POST',
    body: JSON.stringify({ files }),
  })
}
