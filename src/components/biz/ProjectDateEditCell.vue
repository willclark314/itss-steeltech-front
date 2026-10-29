<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: string
    loading?: boolean
    disabled?: boolean
    /** date=年月日；month=年月 */
    type?: 'date' | 'month'
  }>(),
  {
    type: 'date',
  },
)

const emit = defineEmits<{
  change: [value: string]
}>()

const editing = ref(false)
const draftValue = ref('')
const pickerRef = ref<{ focus?: () => void }>()

const valueFormat = computed(() => (props.type === 'month' ? 'YYYY-MM' : 'YYYY-MM-DD'))

const displayText = computed(() => {
  const text = (props.modelValue || '').trim()
  if (!text) return ''
  return props.type === 'month' ? text.slice(0, 7) : text
})

async function startEdit() {
  if (props.loading || props.disabled) return
  draftValue.value = displayText.value
  editing.value = true
  await nextTick()
  pickerRef.value?.focus?.()
}

function stopEdit() {
  editing.value = false
}

function handlePickerInput(value: string | null) {
  draftValue.value = value ?? ''
}

function handleCommit(value: string | null) {
  const next = value ?? ''
  if (next === displayText.value) return
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
    :class="{
      'is-loading': loading,
      'is-empty': !displayText,
      'is-disabled': disabled,
    }"
    :disabled="loading || disabled"
    @click.stop="startEdit"
  >
    {{ displayText || '-' }}
  </button>

  <el-date-picker
    v-else
    ref="pickerRef"
    v-model="draftValue"
    :type="type"
    size="small"
    :disabled="loading"
    :value-format="valueFormat"
    :format="valueFormat"
    clearable
    placeholder="-"
    class="project-date-picker"
    @update:model-value="handlePickerInput"
    @change="handleCommit"
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

.date-display.is-loading,
.date-display.is-disabled {
  cursor: not-allowed;
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
