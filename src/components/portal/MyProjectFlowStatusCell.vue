<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { saveDetailWorkflow, updateProject } from '@/api/projects'
import { DetailWorkflowForm, ProjectForm } from '@/models/biz/project'
import { MyProjectForm } from '@/models/portal/MyProjectForm'
import type { DetailWorkflowEditForm, ProjectRecord, ProjectStatus } from '@/models/biz/project'
import type { MyProjectFlowSegment, MyProjectFlowSegmentKind } from '@/models/portal/MyProjectForm'
import type { NatureProgressPhase } from '@/models/biz/project/ProjectForm'

const props = defineProps<{
  project: ProjectRecord
  personnelTeam?: string
  loadingKey?: string
  fullEditAccess?: boolean
}>()

const emit = defineEmits<{
  updated: [project: ProjectRecord]
  saving: [key: string]
  saved: [key: string]
}>()

const detailPopoverVisible = ref(false)
const detailSaving = ref(false)
const detailForm = reactive<DetailWorkflowEditForm>({
  plateLayoutEnabled: true,
  modelingStatus: 'not_started',
  modelingStartedAt: '',
  modelingCompletedAt: '',
  drawingStatus: 'not_started',
  drawingStartedAt: '',
  drawingCompletedAt: '',
  plateLayoutStatus: 'not_applicable',
  plateLayoutStartedAt: '',
  plateLayoutCompletedAt: '',
})

const internalLoadingKey = ref('')

const effectiveLoadingKey = computed(() => props.loadingKey ?? internalLoadingKey.value)

const segments = computed(() =>
  props.fullEditAccess
    ? MyProjectForm.getAdminFlowSegments(props.project)
    : MyProjectForm.getFlowSegments(props.project, props.personnelTeam || ''),
)

const detailPhaseRows = computed(() =>
  DetailWorkflowForm.getEditablePhaseRows(detailForm),
)

function segmentKey(segment: MyProjectFlowSegment, index: number) {
  return `${segment.kind}:${segment.label}:${index}`
}

function isSegmentLoading(kind: MyProjectFlowSegmentKind) {
  return effectiveLoadingKey.value === `${props.project.projectNo}:${kind}`
}

function resetDetailForm() {
  if (!props.project.detailWorkflow) return
  Object.assign(detailForm, DetailWorkflowForm.createEditForm(props.project.detailWorkflow))
}

watch(
  () => props.project.detailWorkflow,
  () => resetDetailForm(),
  { immediate: true, deep: true },
)

async function saveProject(
  kind: MyProjectFlowSegmentKind,
  saver: () => Promise<ProjectRecord>,
  successMessage: string,
) {
  const key = `${props.project.projectNo}:${kind}`
  if (props.loadingKey === undefined) {
    internalLoadingKey.value = key
  } else {
    emit('saving', key)
  }
  try {
    const updated = await saver()
    emit('updated', updated)
    ElMessage.success(successMessage)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    if (props.loadingKey === undefined) {
      internalLoadingKey.value = ''
    } else {
      emit('saved', key)
    }
  }
}

async function handleProcessStatusChange(status: ProjectStatus) {
  if (status === props.project.status) return
  await saveProject(
    'process',
    () => updateProject(props.project.projectNo, MyProjectForm.buildProcessStatusPayload(status)),
    '流程状态已保存',
  )
}

async function handleDesignProgressChange(phase: NatureProgressPhase) {
  const currentPhase =
    ProjectForm.getNatureProgressPhase(props.project, ProjectForm.NATURE.DESIGN) ?? 'not_started'
  if (phase === currentPhase) return
  await saveProject(
    'design',
    () => updateProject(props.project.projectNo, MyProjectForm.buildDesignProgressPayload(phase)),
    '设计进度已保存',
  )
}

async function handleSimpleDetailProgressChange(phase: NatureProgressPhase) {
  const currentPhase =
    ProjectForm.getNatureProgressPhase(props.project, ProjectForm.NATURE.DETAIL) ?? 'not_started'
  if (phase === currentPhase) return
  await saveProject(
    'detail',
    () =>
      updateProject(
        props.project.projectNo,
        MyProjectForm.buildSimpleDetailProgressPayload(phase),
      ),
    '细化进度已保存',
  )
}

function handlePlateLayoutEnabledChange(value: string | number | boolean) {
  DetailWorkflowForm.applyPlateLayoutEnabledChange(detailForm, Boolean(value))
}

function handleDetailStatusChange(
  row: (typeof detailPhaseRows.value)[number],
  status: DetailWorkflowEditForm[typeof row.statusKey],
) {
  detailForm[row.statusKey] = status
  if (status === 'not_started' || status === 'not_applicable') {
    detailForm[row.startedAtKey] = ''
    detailForm[row.completedAtKey] = ''
  } else if (status === 'in_progress') {
    detailForm[row.completedAtKey] = ''
  }
}

async function handleDetailWorkflowSave() {
  if (!props.project.detailWorkflow) return
  detailSaving.value = true
  const detailKey = `${props.project.projectNo}:detail`
  if (props.loadingKey === undefined) {
    internalLoadingKey.value = detailKey
  } else {
    emit('saving', detailKey)
  }
  try {
    const updated = await saveDetailWorkflow(
      props.project.projectNo,
      DetailWorkflowForm.toSavePayload(detailForm),
    )
    emit('updated', updated)
    detailPopoverVisible.value = false
    ElMessage.success('细化流程已保存')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存细化流程失败')
  } finally {
    detailSaving.value = false
    if (props.loadingKey === undefined) {
      internalLoadingKey.value = ''
    } else {
      emit('saved', detailKey)
    }
  }
}
</script>

<template>
  <div class="flow-status-tag-list my-flow-status-cell">
    <template v-for="(segment, index) in segments" :key="segmentKey(segment, index)">
      <el-dropdown
        v-if="segment.kind === 'process' && segment.editable"
        trigger="click"
        @command="handleProcessStatusChange"
      >
        <el-tag
          size="small"
          :type="segment.type"
          class="cell-tag cell-tag--clickable"
          :class="{ 'is-loading': isSegmentLoading('process') }"
          @click.stop
        >
          {{ segment.label }}
        </el-tag>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item
              v-for="option in MyProjectForm.getProcessStatusOptions()"
              :key="option.value"
              :command="option.value"
              :disabled="option.value === project.status"
            >
              {{ option.label }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <el-tag
        v-else-if="segment.kind === 'process'"
        size="small"
        :type="segment.type"
        class="cell-tag"
      >
        {{ segment.label }}
      </el-tag>

      <el-dropdown
        v-else-if="segment.kind === 'design' && segment.editable"
        trigger="click"
        @command="handleDesignProgressChange"
      >
        <el-tag
          size="small"
          :type="segment.type"
          class="cell-tag cell-tag--clickable"
          :class="{ 'is-loading': isSegmentLoading('design') }"
          @click.stop
        >
          {{ segment.label }}
        </el-tag>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item
              v-for="option in MyProjectForm.getDesignProgressOptions(project)"
              :key="option.value"
              :command="option.value"
              :disabled="option.selected"
            >
              {{ option.label }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <el-popover
        v-else-if="segment.kind === 'detail' && segment.editable && segment.usesDetailWorkflow"
        v-model:visible="detailPopoverVisible"
        placement="bottom-start"
        :width="400"
        trigger="click"
        popper-class="my-detail-workflow-popover"
        @show="resetDetailForm"
      >
        <template #reference>
          <el-tag
            size="small"
            :type="segment.type"
            class="cell-tag cell-tag--clickable"
            :class="{ 'is-loading': isSegmentLoading('detail') }"
            @click.stop
          >
            {{ segment.label }}
          </el-tag>
        </template>

        <div class="my-detail-workflow-editor" @click.stop>
          <div class="my-detail-workflow-editor__title">细化主流程</div>
          <div
            v-for="phase in detailPhaseRows"
            :key="phase.key"
            class="my-detail-workflow-editor__phase"
          >
            <div class="my-detail-workflow-editor__phase-head">
              <span>
                {{ phase.label }}
                <span v-if="phase.key === 'plate_layout'" class="my-detail-workflow-editor__sublabel">（钢板）</span>
              </span>
              <div class="my-detail-workflow-editor__phase-actions">
                <el-switch
                  v-if="phase.key === 'plate_layout'"
                  :model-value="detailForm.plateLayoutEnabled"
                  inline-prompt
                  active-text="启用"
                  inactive-text="关闭"
                  :disabled="detailSaving"
                  :teleported="false"
                  @update:model-value="handlePlateLayoutEnabledChange"
                />
                <el-tag
                  size="small"
                  :type="DetailWorkflowForm.getPhaseStatusMeta(detailForm[phase.statusKey]).type"
                >
                  {{ DetailWorkflowForm.getPhaseStatusMeta(detailForm[phase.statusKey]).label }}
                </el-tag>
              </div>
            </div>
            <p v-if="phase.hint" class="my-detail-workflow-editor__hint">{{ phase.hint }}</p>
            <el-select
              :model-value="detailForm[phase.statusKey]"
              size="small"
              :disabled="!phase.editable || detailSaving"
              :teleported="false"
              style="width: 100%"
              @update:model-value="(value) => handleDetailStatusChange(phase, value)"
            >
              <el-option
                v-for="option in phase.statusOptions"
                :key="option"
                :label="DetailWorkflowForm.STATUS_LABELS[option]"
                :value="option"
              />
            </el-select>
            <div class="my-detail-workflow-editor__times">
              <div class="my-detail-workflow-editor__time-field">
                <span>开始时间</span>
                <el-date-picker
                  v-model="detailForm[phase.startedAtKey]"
                  type="datetime"
                  size="small"
                  placeholder="选择开始时间"
                  :value-format="DetailWorkflowForm.DATETIME_FORMAT"
                  :disabled="
                    !phase.editable ||
                    detailSaving ||
                    !DetailWorkflowForm.isTimeFieldEnabled(detailForm[phase.statusKey], 'started')
                  "
                  :teleported="false"
                  style="width: 100%"
                />
              </div>
              <div class="my-detail-workflow-editor__time-field">
                <span>完成时间</span>
                <el-date-picker
                  v-model="detailForm[phase.completedAtKey]"
                  type="datetime"
                  size="small"
                  placeholder="选择完成时间"
                  :value-format="DetailWorkflowForm.DATETIME_FORMAT"
                  :disabled="
                    !phase.editable ||
                    detailSaving ||
                    !DetailWorkflowForm.isTimeFieldEnabled(detailForm[phase.statusKey], 'completed')
                  "
                  :teleported="false"
                  style="width: 100%"
                />
              </div>
            </div>
          </div>

          <div class="my-detail-workflow-editor__footer">
            <el-button size="small" @click="detailPopoverVisible = false">取消</el-button>
            <el-button
              type="primary"
              size="small"
              :loading="detailSaving"
              @click="handleDetailWorkflowSave"
            >
              保存
            </el-button>
          </div>
        </div>
      </el-popover>

      <el-dropdown
        v-else-if="segment.kind === 'detail' && segment.editable && !segment.usesDetailWorkflow"
        trigger="click"
        @command="handleSimpleDetailProgressChange"
      >
        <el-tag
          size="small"
          :type="segment.type"
          class="cell-tag cell-tag--clickable"
          :class="{ 'is-loading': isSegmentLoading('detail') }"
          @click.stop
        >
          {{ segment.label }}
        </el-tag>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item
              v-for="option in MyProjectForm.getSimpleDetailProgressOptions(project)"
              :key="option.value"
              :command="option.value"
              :disabled="option.selected"
            >
              {{ option.label }}
            </el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <el-tag
        v-else
        size="small"
        :type="segment.type"
        class="cell-tag"
      >
        {{ segment.label }}
      </el-tag>
    </template>
  </div>
</template>

<style scoped>
.my-flow-status-cell {
  flex-wrap: wrap;
}

.my-flow-status-cell .cell-tag.is-loading {
  opacity: 0.6;
  cursor: wait;
}

.my-detail-workflow-editor {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.my-detail-workflow-editor__title {
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.my-detail-workflow-editor__phase {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.my-detail-workflow-editor__phase-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: var(--el-text-color-regular);
}

.my-detail-workflow-editor__phase-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.my-detail-workflow-editor__sublabel {
  margin-left: 2px;
  color: var(--el-text-color-secondary);
}

.my-detail-workflow-editor__hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}

.my-detail-workflow-editor__times {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.my-detail-workflow-editor__time-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.my-detail-workflow-editor__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>

<style>
.my-detail-workflow-popover {
  overflow: visible;
}
</style>
