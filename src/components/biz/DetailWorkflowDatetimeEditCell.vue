<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { DetailWorkflowForm } from '@/models/biz/project'

const props = defineProps<{
  modelValue: string
  loading?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{
  change: [value: string]
}>()

const editing = ref(false)
const pickerRef = ref<{ focus?: () => void }>()

const displayText = computed(() => DetailWorkflowForm.formatWorkflowDatetimeDisplay(props.modelValue))
const tooltipText = computed(() => (props.modelValue || '').trim())

async function startEdit() {
  if (props.loading || props.disabled) return
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
  <el-tooltip
    v-if="!editing && tooltipText"
    :content="tooltipText"
    placement="top"
    :show-after="200"
  >
    <button
      type="button"
      class="datetime-display"
      :class="{
        'is-loading': loading,
        'is-empty': displayText === '-',
        'is-disabled': disabled,
      }"
      :disabled="loading || disabled"
      @click.stop="startEdit"
    >
      {{ displayText }}
    </button>
  </el-tooltip>

  <button
    v-else-if="!editing"
    type="button"
    class="datetime-display"
    :class="{
      'is-loading': loading,
      'is-empty': displayText === '-',
      'is-disabled': disabled,
    }"
    :disabled="loading || disabled"
    @click.stop="startEdit"
  >
    {{ displayText }}
  </button>

  <el-date-picker
    v-else
    ref="pickerRef"
    :model-value="modelValue || undefined"
    type="datetime"
    size="small"
    :disabled="loading"
    :value-format="DetailWorkflowForm.DATETIME_FORMAT"
    :format="DetailWorkflowForm.DATETIME_FORMAT"
    clearable
    placeholder="-"
    class="detail-workflow-datetime-picker"
    @update:model-value="handleChange"
    @visible-change="handleVisibleChange"
    @click.stop
  />
</template>

<style scoped>
.datetime-display {
  display: block;
  width: 100%;
  height: var(--biz-table-row-height, 35px);
  padding: 0 2px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--el-text-color-regular);
  font-size: 12px;
  line-height: var(--biz-table-row-height, 35px);
  text-align: center;
  cursor: pointer;
  white-space: nowrap;
}

.datetime-display:hover:not(:disabled) {
  background: var(--el-fill-color-light);
}

.datetime-display.is-empty {
  color: var(--el-text-color-placeholder);
}

.datetime-display.is-loading,
.datetime-display.is-disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.detail-workflow-datetime-picker {
  width: 100%;
}

.detail-workflow-datetime-picker :deep(.el-input__wrapper) {
  min-height: 24px;
  height: 24px;
  padding: 0 4px;
  box-shadow: 0 0 0 1px var(--el-input-hover-border-color) inset;
  background: var(--el-fill-color-blank);
}

.detail-workflow-datetime-picker :deep(.el-input__inner) {
  height: 24px;
  font-size: 12px;
  line-height: 24px;
  text-align: center;
}
</style>
