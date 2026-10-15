<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { saveDetailWorkflow } from '@/api/projects'
import { DetailWorkflowForm } from '@/models/biz/project'
import type { DetailWorkflowEditForm, ProjectRecord } from '@/models/biz/project'

const props = defineProps<{
  record: ProjectRecord
}>()

const emit = defineEmits<{
  updated: [record: ProjectRecord]
}>()

const saving = ref(false)
const editForm = reactive<DetailWorkflowEditForm>({
  plateLayoutEnabled: true,
  modelingStatus: 'not_started',
  modelingStartedAt: '',
  modelingCompletedAt: '',
  drawingStatus: 'not_started',
  drawingStartedAt: '',
  drawingCompletedAt: '',
  plateLayoutStatus: 'not_started',
  plateLayoutStartedAt: '',
  plateLayoutCompletedAt: '',
})

const workflow = computed(() => props.record.detailWorkflow ?? null)
const hasWorkflow = computed(() =>
  DetailWorkflowForm.needsDetailWorkflow(props.record.natures),
)
const phaseRows = computed(() => DetailWorkflowForm.getEditablePhaseRows(editForm))
const mainPhaseMeta = computed(() => DetailWorkflowForm.getMainPhaseMeta(props.record))

function resetFormFromRecord() {
  if (!workflow.value) return
  Object.assign(editForm, DetailWorkflowForm.createEditForm(workflow.value))
}

watch(
  () => props.record,
  () => resetFormFromRecord(),
  { immediate: true, deep: true },
)

function handleStatusChange(
  row: (typeof phaseRows.value)[number],
  status: DetailWorkflowEditForm[typeof row.statusKey],
) {
  editForm[row.statusKey] = status
  if (status === 'not_started' || status === 'not_applicable') {
    editForm[row.startedAtKey] = ''
    editForm[row.completedAtKey] = ''
  } else if (status === 'in_progress') {
    editForm[row.completedAtKey] = ''
  }
}

function handlePlateLayoutEnabledChange(value: string | number | boolean) {
  DetailWorkflowForm.applyPlateLayoutEnabledChange(editForm, Boolean(value))
}

async function handleSave() {
  if (!workflow.value) return

  saving.value = true
  try {
    const updated = await saveDetailWorkflow(
      props.record.projectNo,
      DetailWorkflowForm.toSavePayload(editForm),
    )
    emit('updated', updated)
    ElMessage.success('细化流程已保存')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存细化流程失败')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="hasWorkflow" class="detail-workflow-panel">
    <div class="detail-workflow-panel__summary">
      <span class="detail-workflow-panel__title">细化主流程</span>
      <el-tag size="small" :type="mainPhaseMeta.type">{{ mainPhaseMeta.label }}</el-tag>
      <el-tag v-if="record.detailCompleted" size="small" type="success">
        已汇总完成
      </el-tag>
    </div>

    <div v-if="workflow" class="detail-workflow-panel__phases">
      <div
        v-for="phase in phaseRows"
        :key="phase.key"
        class="detail-workflow-phase"
      >
        <div class="detail-workflow-phase__head">
          <span class="detail-workflow-phase__label">
            {{ phase.label }}
            <span v-if="phase.key === 'plate_layout'" class="detail-workflow-phase__sublabel">（钢板）</span>
          </span>
          <div class="detail-workflow-phase__head-actions">
            <el-switch
              v-if="phase.key === 'plate_layout'"
              :model-value="editForm.plateLayoutEnabled"
              inline-prompt
              active-text="启用"
              inactive-text="关闭"
              :disabled="saving"
              @update:model-value="handlePlateLayoutEnabledChange"
            />
            <el-tag
              size="small"
              :type="DetailWorkflowForm.getPhaseStatusMeta(editForm[phase.statusKey]).type"
            >
              {{ DetailWorkflowForm.getPhaseStatusMeta(editForm[phase.statusKey]).label }}
            </el-tag>
          </div>
        </div>

        <p v-if="phase.hint" class="detail-workflow-phase__hint">{{ phase.hint }}</p>

        <div class="detail-workflow-phase__fields">
          <div class="detail-workflow-phase__field">
            <span class="detail-workflow-phase__field-label">阶段状态</span>
            <el-select
              :model-value="editForm[phase.statusKey]"
              size="small"
              :disabled="!phase.editable || saving"
              style="width: 100%"
              @update:model-value="(value) => handleStatusChange(phase, value)"
            >
              <el-option
                v-for="option in phase.statusOptions"
                :key="option"
                :label="DetailWorkflowForm.STATUS_LABELS[option]"
                :value="option"
              />
            </el-select>
          </div>

          <div class="detail-workflow-phase__field">
            <span class="detail-workflow-phase__field-label">开始时间</span>
            <el-date-picker
              v-model="editForm[phase.startedAtKey]"
              type="datetime"
              size="small"
              placeholder="选择开始时间"
              :value-format="DetailWorkflowForm.DATETIME_FORMAT"
              :disabled="!phase.editable || saving || !DetailWorkflowForm.isTimeFieldEnabled(editForm[phase.statusKey], 'started')"
              style="width: 100%"
            />
          </div>

          <div class="detail-workflow-phase__field">
            <span class="detail-workflow-phase__field-label">完成时间</span>
            <el-date-picker
              v-model="editForm[phase.completedAtKey]"
              type="datetime"
              size="small"
              placeholder="选择完成时间"
              :value-format="DetailWorkflowForm.DATETIME_FORMAT"
              :disabled="!phase.editable || saving || !DetailWorkflowForm.isTimeFieldEnabled(editForm[phase.statusKey], 'completed')"
              style="width: 100%"
            />
          </div>
        </div>
      </div>
    </div>

    <div v-else class="detail-workflow-panel__empty">
      保存项目性质后将自动创建细化流程记录。
    </div>

    <div v-if="workflow" class="detail-workflow-panel__footer">
      <el-button type="primary" size="small" :loading="saving" @click="handleSave">
        保存细化流程
      </el-button>
    </div>
  </div>
</template>

<style scoped>
.detail-workflow-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  padding: 12px 14px;
  border: 1px solid var(--el-border-color-light);
  border-radius: 8px;
  background: var(--el-fill-color-blank);
}

.detail-workflow-panel__summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.detail-workflow-panel__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.detail-workflow-panel__phases {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.detail-workflow-phase {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 14px;
  border-bottom: 1px dashed var(--el-border-color-lighter);
}

.detail-workflow-phase:last-child {
  padding-bottom: 0;
  border-bottom: none;
}

.detail-workflow-phase__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.detail-workflow-phase__head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-workflow-phase__label {
  min-width: 72px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.detail-workflow-phase__sublabel {
  margin-left: 4px;
  font-size: 12px;
  font-weight: 400;
  color: var(--el-text-color-secondary);
}

.detail-workflow-phase__hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}

.detail-workflow-phase__fields {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.detail-workflow-phase__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.detail-workflow-phase__field-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.detail-workflow-panel__empty {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.detail-workflow-panel__footer {
  display: flex;
  justify-content: flex-end;
}

@media (max-width: 720px) {
  .detail-workflow-phase__fields {
    grid-template-columns: 1fr;
  }
}
</style>
