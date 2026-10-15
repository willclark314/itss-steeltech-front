import { ref } from 'vue'
import { fetchTags } from '@/api/tags'
import type { TagRecord } from '@/models/biz/tag'

const tagOptions = ref<TagRecord[]>([])
let loadPromise: Promise<TagRecord[]> | null = null
let loaded = false

async function loadTags(force = false): Promise<TagRecord[]> {
  if (!force && loaded) return tagOptions.value
  if (!force && loadPromise) return loadPromise

  loadPromise = fetchTags()
    .then((result) => {
      tagOptions.value = result
      loaded = true
      return result
    })
    .catch(() => {
      return tagOptions.value
    })
    .finally(() => {
      loadPromise = null
    })

  return loadPromise
}

function addTag(tag: TagRecord) {
  tagOptions.value = [...tagOptions.value, tag].sort((a, b) =>
    a.name.localeCompare(b.name, 'zh-CN'),
  )
}

export function useTagCache() {
  return {
    tagOptions,
    loadTags,
    addTag,
  }
}
