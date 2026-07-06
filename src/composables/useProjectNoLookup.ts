import { ref } from 'vue'
import { checkProjectNos } from '@/api/projects'

function mergeIntoSet(target: Set<string>, items: string[]) {
  if (!items.length) return target
  return new Set([...target, ...items])
}

export function useProjectNoLookup() {
  const existing = ref(new Set<string>())
  const exact = ref(new Set<string>())

  async function sync(projectNos: string[]) {
    const unique = [...new Set(projectNos.map((item) => item.trim()).filter(Boolean))]
    if (!unique.length) return

    const pending = unique.filter((projectNo) => !existing.value.has(projectNo))
    if (!pending.length) return

    try {
      const result = await checkProjectNos(pending)
      existing.value = mergeIntoSet(existing.value, result.existing)
      exact.value = mergeIntoSet(exact.value, result.exact)
    } catch {
      // 保留已有缓存，避免接口失败时清空状态
    }
  }

  function markCreated(projectNo: string, exactProjectNo?: string) {
    existing.value = mergeIntoSet(existing.value, [projectNo])
    if (exactProjectNo) {
      exact.value = mergeIntoSet(exact.value, [exactProjectNo])
    }
  }

  function invalidate(projectNos: string[]) {
    if (!projectNos.length) return
    const remove = new Set(projectNos)
    existing.value = new Set([...existing.value].filter((item) => !remove.has(item)))
    exact.value = new Set([...exact.value].filter((item) => !remove.has(item)))
  }

  function clear() {
    existing.value = new Set()
    exact.value = new Set()
  }

  return {
    existing,
    exact,
    sync,
    markCreated,
    invalidate,
    clear,
  }
}
