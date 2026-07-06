<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { DetailWorkflowForm } from '@/models/biz/project'
import { MyProjectForm } from '@/models/portal/MyProjectForm'
import type { ProjectRecord } from '@/models/biz/project'

const props = defineProps<{
  project: ProjectRecord
  personnelTeam: string
  loading?: boolean
}>()

const emit = defineEmits<{
  change: [value: number | null]
}>()

const editing = ref(false)
const draft = ref<number | null>(null)
const inputRef = ref<{ focus?: () => void }>()

const applicable = computed(
  () =>
    DetailWorkflowForm.needsDetailWorkflow(props.project.natures) &&
    Boolean(props.project.detailWorkflow),
)

const editable = computed(
  () => applicable.value && MyProjectForm.canEditDetailProgress(props.personnelTeam, props.project),
)

const displayValue = computed(() =>
  DetailWorkflowForm.formatModelWeightDisplay(props.project.detailWorkflow?.modelWeightTons),
)

const auditTooltip = computed(() =>
  DetailWorkflowForm.getModelWeightAuditTooltip(props.project.detailWorkflow),
)

async function startEdit() {
  if (!editable.value || props.loading) return
  draft.value = props.project.detailWorkflow?.modelWeightTons ?? null
  editing.value = true
  await nextTick()
  inputRef.value?.focus?.()
}

function stopEdit() {
  editing.value = false
}

function handleChange(value: number | null | undefined) {
  const next = value ?? null
  const current = props.project.detailWorkflow?.modelWeightTons ?? null
  stopEdit()
  if (next === current) return
  emit('change', next)
}

function handleBlur() {
  if (!editing.value) return
  handleChange(draft.value)
}
</script>

<template>
  <span v-if="!applicable" class="text-muted">-</span>

  <el-input-number
    v-else-if="editing"
    ref="inputRef"
    v-model="draft"
    :min="0"
    :precision="3"
    :step="0.001"
    :controls="false"
    size="small"
    class="model-weight-input"
    :disabled="loading"
    @blur="handleBlur"
    @keyup.enter="handleBlur"
    @click.stop
  />

  <el-tooltip
    v-else
    :content="auditTooltip"
    placement="top"
    :show-after="200"
    :disabled="!auditTooltip"
  >
    <button
      type="button"
      class="model-weight-display"
      :class="{
        'is-loading': loading,
        'is-empty': displayValue === '-',
        'is-readonly': !editable,
      }"
      :disabled="loading || !editable"
      @click.stop="startEdit"
    >
      {{ displayValue }}
    </button>
  </el-tooltip>
</template>

<style scoped>
.model-weight-display {
  display: block;
  width: 100%;
  height: var(--biz-table-row-height, 35px);
  padding: 0 4px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--el-text-color-regular);
  font-size: 13px;
  line-height: var(--biz-table-row-height, 35px);
  text-align: center;
  cursor: pointer;
}

.model-weight-display.is-readonly {
  cursor: default;
}

.model-weight-display.is-empty {
  color: var(--el-text-color-placeholder);
}

.model-weight-display:not(.is-readonly):hover {
  background: var(--el-fill-color-light);
}

.model-weight-display.is-loading {
  opacity: 0.6;
  cursor: wait;
}

.model-weight-input {
  width: 100%;
}

.model-weight-input :deep(.el-input__wrapper) {
  padding: 0 6px;
}

.text-muted {
  display: block;
  text-align: center;
  color: var(--el-text-color-placeholder);
  font-size: 13px;
  line-height: var(--biz-table-row-height, 35px);
}
</style>
