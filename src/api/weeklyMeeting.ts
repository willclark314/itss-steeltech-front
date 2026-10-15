import { request } from './request'

export interface WeeklyMeetingImage {
  id: string
  meetingId: string
  fileName: string
  filePath: string
  fileSize: number
  mimeType: string
  sortOrder: number
  url: string
}

export interface WeeklyMeetingScan {
  id: string
  meetingId: string
  fileName: string
  filePath: string
  fileSize: number
  mimeType: string
  url: string
}

export interface WeeklyMeetingRecord {
  id: string
  meetingDate: string
  meetingTheme: string
  location: string
  host: string
  recorder: string
  attendees: string
  contentItems: string[]
  images: WeeklyMeetingImage[]
  recordScan: WeeklyMeetingScan | null
  createdAt: string
  updatedAt: string | null
}

export interface WeeklyMeetingListResult {
  list: WeeklyMeetingRecord[]
  total: number
}

export interface CreateMeetingPayload {
  meetingDate: string
  meetingTheme: string
  location: string
  host: string
  recorder: string
  attendees: string
  contentItems: string[]
}

export interface UpdateMeetingPayload {
  meetingDate?: string
  meetingTheme?: string
  location?: string
  host?: string
  recorder?: string
  attendees?: string
  contentItems?: string[]
}

export interface ImageUploadItem {
  fileName: string
  content: string  // base64
  mimeType: string
}

export interface ScanUploadItem {
  fileName: string
  content: string  // base64
  mimeType: string
}

export function fetchMeetingList(year?: string, month?: string) {
  const query = new URLSearchParams()
  if (year) query.set('year', year)
  if (month) query.set('month', month)
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return request<WeeklyMeetingListResult>(`/weekly-meetings${suffix}`)
}

export function fetchMeeting(id: string) {
  return request<WeeklyMeetingRecord>(`/weekly-meetings/${encodeURIComponent(id)}`)
}

export function createMeeting(payload: CreateMeetingPayload) {
  return request<WeeklyMeetingRecord>('/weekly-meetings', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateMeeting(id: string, payload: UpdateMeetingPayload) {
  return request<WeeklyMeetingRecord>(`/weekly-meetings/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deleteMeeting(id: string) {
  return request<{ ok: boolean }>(`/weekly-meetings/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export function uploadMeetingImages(meetingId: string, files: ImageUploadItem[]) {
  return request<{ images: WeeklyMeetingImage[] }>(
    `/weekly-meetings/${encodeURIComponent(meetingId)}/images`,
    {
      method: 'POST',
      body: JSON.stringify({ files }),
    },
  )
}

export function deleteMeetingImage(meetingId: string, imageId: string) {
  return request<{ ok: boolean }>(
    `/weekly-meetings/${encodeURIComponent(meetingId)}/images/${encodeURIComponent(imageId)}`,
    {
      method: 'DELETE',
    },
  )
}

export function uploadMeetingScan(meetingId: string, file: ScanUploadItem) {
  return request<{ recordScan: WeeklyMeetingScan }>(
    `/weekly-meetings/${encodeURIComponent(meetingId)}/scan`,
    {
      method: 'POST',
      body: JSON.stringify({ file }),
    },
  )
}

export function deleteMeetingScan(meetingId: string) {
  return request<{ ok: boolean }>(
    `/weekly-meetings/${encodeURIComponent(meetingId)}/scan`,
    {
      method: 'DELETE',
    },
  )
}

export function getExportUrl(meetingId: string): string {
  return `/api/weekly-meetings/${encodeURIComponent(meetingId)}/export`
}

/**
 * Read a File as base64-encoded data URL content.
 */
export function readFileAsBase64(file: File): Promise<{ content: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      // data:image/png;base64,xxxxx
      const commaIndex = dataUrl.indexOf(',')
      const mimeType = dataUrl.substring(5, commaIndex).replace(';base64', '')
      const content = dataUrl.substring(commaIndex + 1)
      resolve({ content, mimeType })
    }
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
}
