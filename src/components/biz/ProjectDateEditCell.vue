<script setup lang="ts">
import { nextTick, ref } from 'vue'
const props = defineProps<{
  modelValue: string
  loading?: boolean
}>()

const emit = defineEmits<{
  change: [value: string]
}>()

const editing = ref(false)
const pickerRef = ref<{ focus?: () => void }>()

async function startEdit() {
  if (props.loading) return
  editing.value = true
  await nextTick()
  pickerRef.value?.focus?.()
}

function stopEdit() {
  editing.value = false
}

function handleChange(value: string | null) {
  const next = value ?? ''
  stopEdit()
  if (next === props.modelValue) return
  emit('change', next)
}

function handleVisibleChange(visible: boolean) {
  if (!visible) stopEdit()
}
</script>

<template>
  <button
    v-if="!editing"
    type="button"
    class="date-display"
    :class="{ 'is-loading': loading, 'is-empty': !modelValue }"
    :disabled="loading"
    @click.stop="startEdit"
  >
    {{ modelValue || '-' }}
  </button>

  <el-date-picker
    v-else
    ref="pickerRef"
    :model-value="modelValue || undefined"
    type="date"
    size="small"
    :disabled="loading"
    value-format="YYYY-MM-DD"
    format="YYYY-MM-DD"
    clearable
    placeholder="-"
    class="project-date-picker"
    @update:model-value="handleChange"
    @visible-change="handleVisibleChange"
    @click.stop
  />
</template>

<style scoped>
.date-display {
  display: block;
  width: 100%;
  height: var(--biz-table-row-height, 35px);
  padding: 0 2px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--el-text-color-regular);
  font-size: 13px;
  line-height: var(--biz-table-row-height, 35px);
  text-align: center;
  cursor: pointer;
}

.date-display:hover:not(:disabled) {
  background: var(--el-fill-color-light);
}

.date-display.is-empty {
  color: var(--el-text-color-placeholder);
}

.date-display.is-loading {
  cursor: wait;
  opacity: 0.6;
}

.project-date-picker {
  width: 100%;
}

.project-date-picker :deep(.el-input__wrapper) {
  min-height: 24px;
  height: 24px;
  padding: 0 4px;
  box-shadow: 0 0 0 1px var(--el-input-hover-border-color) inset;
  background: var(--el-fill-color-blank);
}

.project-date-picker :deep(.el-input__inner) {
  height: 24px;
  font-size: 13px;
  line-height: 24px;
  text-align: center;
}
</style>
