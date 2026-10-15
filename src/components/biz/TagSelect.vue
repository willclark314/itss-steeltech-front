<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { createTag } from '@/api/tags'
import { useTagCache } from '@/composables/useTagCache'

const model = defineModel<string[]>({ default: () => [] })

const props = withDefaults(
  defineProps<{
    placeholder?: string
    width?: string
    disabled?: boolean
    allowCreate?: boolean
  }>(),
  {
    placeholder: '选择或输入新标签',
    width: '100%',
    disabled: false,
    allowCreate: true,
  },
)

const { tagOptions, loadTags, addTag } = useTagCache()

const optionMap = computed(() => new Map(tagOptions.value.map((item) => [item.id, item])))

async function handleCreateTag(name: string) {
  const normalized = name.trim()
  if (!normalized) return
  const existing = tagOptions.value.find((item) => item.name === normalized)
  if (existing) {
    if (!model.value.includes(existing.id)) {
      model.value = [...model.value, existing.id]
    }
    return
  }
  try {
    const created = await createTag(normalized)
    addTag(created)
    if (!model.value.includes(created.id)) {
      model.value = [...model.value, created.id]
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '创建标签失败')
  }
}

onMounted(() => {
  void loadTags()
})

watch(
  () => model.value,
  (ids) => {
    for (const id of ids) {
      if (!optionMap.value.has(id)) {
        void loadTags(true)
        break
      }
    }
  },
  { deep: true },
)
</script>

<template>
  <el-select
    v-model="model"
    multiple
    filterable
    :allow-create="allowCreate"
    default-first-option
    collapse-tags
    collapse-tags-tooltip
    :disabled="disabled"
    :placeholder="placeholder"
    :style="{ width }"
    @create="handleCreateTag"
  >
    <el-option
      v-for="tag in tagOptions"
      :key="tag.id"
      :label="tag.name"
      :value="tag.id"
    />
  </el-select>
</template>
