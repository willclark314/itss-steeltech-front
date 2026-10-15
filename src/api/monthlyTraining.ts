import { request } from './request'

export interface MonthlyTrainingMaterial {
  id: string
  trainingId: string
  fileName: string
  filePath: string
  fileSize: number
  mimeType: string
  materialType: string
  sortOrder: number
  url: string
  createdAt: string
}

export interface MonthlyTrainingPhoto {
  id: string
  trainingId: string
  fileName: string
  filePath: string
  fileSize: number
  mimeType: string
  sortOrder: number
  url: string
  createdAt: string
}

export interface MonthlyTrainingPrimaryPdf {
  fileName: string
  filePath: string
  fileSize: number
  mimeType: string
  url: string
}

export interface MonthlyTrainingRecord {
  id: string
  trainingYear: string
  trainingMonth: string
  itemSeq: number
  categoryTag: string
  title: string
  trainer: string
  archiveNo: string
  trainingDate: string
  primaryPdf: MonthlyTrainingPrimaryPdf | null
  materials: MonthlyTrainingMaterial[]
  photos: MonthlyTrainingPhoto[]
  createdAt: string
  updatedAt: string | null
}

export interface MonthlyTrainingListResult {
  list: MonthlyTrainingRecord[]
  total: number
}

export interface CreateTrainingPayload {
  trainingYear: string
  trainingMonth: string
  itemSeq: number
  categoryTag: string
  title: string
  trainer: string
  archiveNo: string
  trainingDate: string
}

export interface UpdateTrainingPayload {
  trainingYear?: string
  trainingMonth?: string
  itemSeq?: number
  categoryTag?: string
  title?: string
  trainer?: string
  archiveNo?: string
  trainingDate?: string
}

export interface FileUploadItem {
  fileName: string
  content: string  // base64
  mimeType: string
}

export const CATEGORY_TAGS = ['制度类', '管理类', '质量类', '安全类', '技能类'] as const

export const CATEGORY_TAG_COLORS: Record<string, string> = {
  '制度类': '#409EFF',
  '管理类': '#67C23A',
  '质量类': '#E6A23C',
  '安全类': '#F56C6C',
  '技能类': '#909399',
}

export const MATERIAL_TYPE_LABELS: Record<string, string> = {
  training_ppt: '培训课件',
  policy_doc: '制度原文',
  signin_sheet: '签到表',
  training_record: '培训记录',
}

export const MATERIAL_TYPES = [
  { value: 'training_ppt', label: '培训课件' },
  { value: 'policy_doc', label: '制度原文' },
  { value: 'signin_sheet', label: '签到表' },
  { value: 'training_record', label: '培训记录' },
]

export function fetchTrainingList(year?: string, month?: string) {
  const query = new URLSearchParams()
  if (year) query.set('year', year)
  if (month) query.set('month', month)
  const suffix = query.toString() ? `?${query.toString()}` : ''
  return request<MonthlyTrainingListResult>(`/monthly-trainings${suffix}`)
}

export function fetchTraining(id: string) {
  return request<MonthlyTrainingRecord>(`/monthly-trainings/${encodeURIComponent(id)}`)
}

export function createTraining(payload: CreateTrainingPayload) {
  return request<MonthlyTrainingRecord>('/monthly-trainings', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateTraining(id: string, payload: UpdateTrainingPayload) {
  return request<MonthlyTrainingRecord>(`/monthly-trainings/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export function deleteTraining(id: string) {
  return request<{ ok: boolean }>(`/monthly-trainings/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}

export function uploadTrainingPrimaryPdf(trainingId: string, file: FileUploadItem) {
  return request<MonthlyTrainingRecord>(
    `/monthly-trainings/${encodeURIComponent(trainingId)}/primary-pdf`,
    {
      method: 'POST',
      body: JSON.stringify({ file }),
    },
  )
}

export function deleteTrainingPrimaryPdf(trainingId: string) {
  return request<{ ok: boolean }>(
    `/monthly-trainings/${encodeURIComponent(trainingId)}/primary-pdf`,
    { method: 'DELETE' },
  )
}

export function uploadTrainingMaterial(
  trainingId: string,
  file: FileUploadItem,
  materialType: string,
) {
  return request<{ material: MonthlyTrainingMaterial }>(
    `/monthly-trainings/${encodeURIComponent(trainingId)}/materials`,
    {
      method: 'POST',
      body: JSON.stringify({ file, materialType }),
    },
  )
}

export function deleteTrainingMaterial(trainingId: string, materialId: string) {
  return request<{ ok: boolean }>(
    `/monthly-trainings/${encodeURIComponent(trainingId)}/materials/${encodeURIComponent(materialId)}`,
    { method: 'DELETE' },
  )
}

export function uploadTrainingPhotos(trainingId: string, files: FileUploadItem[]) {
  return request<{ photos: MonthlyTrainingPhoto[] }>(
    `/monthly-trainings/${encodeURIComponent(trainingId)}/photos`,
    {
      method: 'POST',
      body: JSON.stringify({ files }),
    },
  )
}

export function deleteTrainingPhoto(trainingId: string, photoId: string) {
  return request<{ ok: boolean }>(
    `/monthly-trainings/${encodeURIComponent(trainingId)}/photos/${encodeURIComponent(photoId)}`,
    { method: 'DELETE' },
  )
}

export function getExportUrl(trainingId: string): string {
  return `/api/monthly-trainings/${encodeURIComponent(trainingId)}/export`
}

/**
 * Read a File as base64-encoded data URL content.
 */
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
