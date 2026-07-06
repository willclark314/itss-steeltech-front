import { request } from './request'
import type { TagRecord } from '@/models/biz/tag'

export function fetchTags() {
  return request<TagRecord[]>('/tags')
}

export function createTag(name: string) {
  return request<TagRecord>('/tags', {
    method: 'POST',
    body: JSON.stringify({ name }),
  })
}
