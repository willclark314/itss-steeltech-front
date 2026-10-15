import { request } from './request'

export interface DirectorInterviewImage {
  id: string
  interviewId: string
  fileName: string
  filePath: string
  fileSize: number
  mimeType: string
  sortOrder: number
  url: string
}

export interface DirectorInterviewRecord {
  id: string
  employeeName: string
  employeeId: string
  division: string
  position: string
  interviewDate: string
  interviewTopic: string
  interviewContent: string[]
  conclusion: string[]
  interviewer: string
  interviewee: string
  images: DirectorInterviewImage[]
  createdAt: string
  updatedAt: string | null
}

export interface DirectorInterviewListResult {
  list: DirectorInterviewRecord[]
  total: number
}

export interface CreateInterviewPayload {
  employeeName: string
  employeeId?: string
  division?: string
  position?: string
  interviewDate: string
  interviewTopic: string
  interviewContent?: string[]
  conclusion?: string[]
  interviewer?: string
  interviewee?: string
}

export interface UpdateInterviewPayload {
  employeeName?: string
  employeeId?: string
  division?: string
  position?: string
  interviewDate?: string
  interviewTopic?: string
  interviewContent?: string[]
  conclusion?: string[]
  interviewer?: string
  interviewee?: string
}

export interface ImageUploadItem {
  fileName: string
  content: string
  mimeType: string
}

export function fetchInterviewList(year?: string, month?: string, keyword?: string) {
  const query = new URLSearchParams()
  if (year) query.set('year', year)
  if (month) query.set('month', month)
  if (keyword) query.set('keyword', keyword)
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return request<DirectorInterviewListResult>(`/director-interviews${suffix}`)
}

export function fetchInterview(id: string) {
  return request<DirectorInterviewRecord>(`/director-interviews/${encodeURIComponent(id)}`)
}

export function createInterview(payload: CreateInterviewPayload) {
  return request<DirectorInterviewRecord>('/director-interviews', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateInterview(id: string, payload: UpdateInterviewPayload) {
  return request<DirectorInterviewRecord>(`/director-interviews/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deleteInterview(id: string) {
  return request<{ ok: boolean }>(`/director-interviews/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export function uploadInterviewImages(interviewId: string, files: ImageUploadItem[]) {
  return request<{ images: DirectorInterviewImage[] }>(
    `/director-interviews/${encodeURIComponent(interviewId)}/images`,
    { method: 'POST', body: JSON.stringify({ files }) },
  )
}

export function deleteInterviewImage(interviewId: string, imageId: string) {
  return request<{ ok: boolean }>(
    `/director-interviews/${encodeURIComponent(interviewId)}/images/${encodeURIComponent(imageId)}`,
    { method: 'DELETE' },
  )
}

export function getExportUrl(interviewId: string): string {
  return `/api/director-interviews/${encodeURIComponent(interviewId)}/export`
}

export function readFileAsBase64(file: File): Promise<{ content: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const commaIndex = dataUrl.indexOf(',')
      const mimeType = dataUrl.substring(5, commaIndex).replace(';base64', '')
      const content = dataUrl.substring(commaIndex + 1)
      resolve({ content, mimeType })
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}
