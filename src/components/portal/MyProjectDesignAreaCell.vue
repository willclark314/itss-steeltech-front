<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { DesignWorkflowForm } from '@/models/biz/project'
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
    DesignWorkflowForm.needsDesignWorkflow(props.project.natures) &&
    Boolean(props.project.designWorkflow),
)

const editable = computed(
  () => applicable.value && MyProjectForm.canEditDesignProgress(props.personnelTeam, props.project),
)

const displayValue = computed(() =>
  DesignWorkflowForm.formatDesignAreaDisplay(props.project.designWorkflow?.designAreaSqm),
)

const auditTooltip = computed(() =>
  DesignWorkflowForm.getDesignAreaAuditTooltip(props.project.designWorkflow),
)

async function startEdit() {
  if (!editable.value || props.loading) return
  draft.value = props.project.designWorkflow?.designAreaSqm ?? null
  editing.value = true
  await nextTick()
  inputRef.value?.focus?.()
}

function stopEdit() {
  editing.value = false
}

function handleChange(value: number | null | undefined) {
  const next = value ?? null
  const current = props.project.designWorkflow?.designAreaSqm ?? null
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
    :precision="2"
    :step="0.01"
    :controls="false"
    size="small"
    class="design-area-input"
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
      class="design-area-display"
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
.design-area-display {
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

.design-area-display.is-readonly {
  cursor: default;
}

.design-area-display.is-empty {
  color: var(--el-text-color-placeholder);
}

.design-area-display:not(.is-readonly):hover {
  background: var(--el-fill-color-light);
}

.design-area-display.is-loading {
  opacity: 0.6;
  cursor: wait;
}

.design-area-input {
  width: 100%;
}

.design-area-input :deep(.el-input__wrapper) {
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
