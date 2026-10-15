<script setup lang="ts">
import '@/styles/biz-data-table.css'
import '@/styles/project-no-info-message.css'
import { ElMessage } from 'element-plus'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import DrawingIssuePlanEditDialog from '@/components/biz/DrawingIssuePlanEditDialog.vue'
import ProjectDateEditCell from '@/components/biz/ProjectDateEditCell.vue'
import ProjectPersonnelCell from '@/components/biz/ProjectPersonnelCell.vue'
import {
  DrawingIssuePlanForm,
  type DrawingIssuePlanEditForm,
  type DrawingIssuePlanRow,
} from '@/models/biz/drawingIssuePlan/DrawingIssuePlanForm'
import { ProjectForm } from '@/models/biz/project'
import type { ProjectRecord } from '@/models/biz/project'
import { copyProjectNoAndShowInfo } from '@/utils/projectNoMessage'

type DateField =
  | 'materialPrepListIssueDate'
  | 'detailPlannedIssueDate'
  | 'detailActualIssueDate'
  | 'floorDeckPlannedIssueDate'
  | 'floorDeckActualIssueDate'

const props = withDefaults(
  defineProps<{
    data: DrawingIssuePlanRow[]
    loading?: boolean
    canEdit?: boolean
    dateSaving?: boolean
    tableHeight?: string | number
    approachingDays?: number
    projectMap?: Map<string, ProjectRecord>
  }>(),
  {
    loading: false,
    canEdit: false,
    dateSaving: false,
    tableHeight: 'calc(100vh - 260px)',
    approachingDays: 7,
  },
)

const emit = defineEmits<{
  remove: [index: number]
  'date-change': []
}>()

const router = useRouter()
const editVisible = ref(false)
const editingRow = ref<DrawingIssuePlanRow | null>(null)

function openEdit(row: DrawingIssuePlanRow) {
  editingRow.value = row
  editVisible.value = true
}

function handleEditSave(form: DrawingIssuePlanEditForm) {
  if (!editingRow.value) return

  const linked = props.projectMap
    ? DrawingIssuePlanForm.resolveLinkedProject(form.projectNo, props.projectMap)
    : null
  const nextProjectNo = (linked?.projectNo ?? form.projectNo).trim().toUpperCase()
  const duplicated = props.data.some(
    (item) =>
      item !== editingRow.value &&
      item.projectNo.trim().toUpperCase() === nextProjectNo,
  )
  if (duplicated) {
    ElMessage.warning('该项目号已在本月计划中')
    return
  }

  if (props.projectMap && !DrawingIssuePlanForm.resolveLinkedProject(form.projectNo, props.projectMap)) {
    ElMessage.warning('请从项目库中选择有效的项目号')
    return
  }

  Object.assign(
    editingRow.value,
    DrawingIssuePlanForm.applyEditForm(editingRow.value, form, props.projectMap),
  )
  editVisible.value = false
}

async function handleProjectNoClick(row: DrawingIssuePlanRow) {
  await copyProjectNoAndShowInfo(router, {
    projectNo: row.projectNo,
    projectName: row.projectName,
    linkedProject: row.linkedProject,
  })
}

function getRowMeta(row: DrawingIssuePlanRow) {
  return DrawingIssuePlanForm.getRowStateMeta(row, new Date(), {
    approachingDays: props.approachingDays,
  })
}

function getPairMeta(planned: string | null | undefined, actual: string | null | undefined) {
  return DrawingIssuePlanForm.getDatePairMeta(planned, actual, new Date(), {
    approachingDays: props.approachingDays,
  })
}

function getRowClassName({ row }: { row: DrawingIssuePlanRow }) {
  return getRowMeta(row).rowClass
}

function isProjectLinked(row: DrawingIssuePlanRow) {
  return Boolean(row.linkedProject)
}

function getProjectNoDisplay(row: DrawingIssuePlanRow) {
  if (row.linkedProject) {
    return ProjectForm.getDisplayProjectNo(row.linkedProject)
  }
  return row.projectNo || '-'
}

function toRow(row: unknown): DrawingIssuePlanRow {
  return row as DrawingIssuePlanRow
}

function handleDateChange(row: DrawingIssuePlanRow, field: DateField, value: string) {
  row[field] = value || null
  emit('date-change')
}
</script>

<template>
  <el-table
    v-loading="loading"
    :data="data"
    stripe
    class="biz-data-table drawing-issue-plan-table"
    :height="tableHeight"
    :row-class-name="getRowClassName"
    style="width: 100%"
    empty-text="本月暂无细化发图计划"
  >
    <el-table-column label="序号" width="64" align="center" header-align="center">
      <template #default="{ $index }">
        {{ $index + 1 }}
      </template>
    </el-table-column>

    <el-table-column label="项目号" width="148" class-name="text-column project-no-column">
      <template #default="{ row }">
        <div class="project-no-cell">
          <el-button
            v-if="toRow(row).projectNo"
            type="primary"
            link
            class="project-no-link"
            :class="{ 'is-unlinked': !isProjectLinked(toRow(row)) }"
            @click="handleProjectNoClick(toRow(row))"
          >
            {{ getProjectNoDisplay(toRow(row)) }}
          </el-button>
          <span v-else class="text-muted">-</span>
          <el-tag
            v-if="canEdit && toRow(row).projectNo && !isProjectLinked(toRow(row))"
            type="warning"
            size="small"
            class="unlink-tag"
          >
            未关联
          </el-tag>
        </div>
      </template>
    </el-table-column>

    <el-table-column label="项目名称" min-width="300" show-overflow-tooltip class-name="text-column">
      <template #default="{ row }">
        <div class="name-cell">
          <span>{{ row.projectName || '-' }}</span>
          <el-tag
            v-if="getRowMeta(toRow(row)).label"
            size="small"
            :type="getRowMeta(toRow(row)).state === 'overdue' ? 'danger' : 'warning'"
            class="issue-tag"
          >
            {{ getRowMeta(toRow(row)).label }}
          </el-tag>
        </div>
      </template>
    </el-table-column>

    <el-table-column
      label="分配人员"
      width="100"
      class-name="tag-column personnel-column"
    >
      <template #default="{ row }">
        <ProjectPersonnelCell :personnel="toRow(row).linkedProject?.assignedPersonnel || []" />
      </template>
    </el-table-column>

    <el-table-column label="模型重(吨)" width="96" align="center" header-align="center" class-name="model-weight-column">
      <template #default="{ row }">
        <span
          class="model-weight-text"
          :class="{ 'text-muted': DrawingIssuePlanForm.getModelWeightDisplay(row.linkedProject) === '-' }"
        >
          {{ DrawingIssuePlanForm.getModelWeightDisplay(row.linkedProject) }}
        </span>
      </template>
    </el-table-column>

    <el-table-column label="构件重量/吨" width="130" align="center" header-align="center">
      <template #default="{ row }">
        <el-input-number
          v-if="canEdit"
          :model-value="DrawingIssuePlanForm.kgToTons(row.componentWeightKg)"
          :min="0"
          :precision="3"
          :step="0.1"
          :controls="false"
          class="weight-input"
          @update:model-value="(value) => { row.componentWeightKg = DrawingIssuePlanForm.tonsToKg(value) }"
        />
        <span
          v-else
          class="model-weight-text"
          :class="{ 'text-muted': DrawingIssuePlanForm.formatComponentWeightTons(row.componentWeightKg) === '-' }"
        >
          {{ DrawingIssuePlanForm.formatComponentWeightTons(row.componentWeightKg) }}
        </span>
      </template>
    </el-table-column>

    <el-table-column
      label="备料清单"
      width="120"
      align="center"
      header-align="center"
      class-name="date-column issue-date-column"
    >
      <template #default="{ row }">
        <ProjectDateEditCell
          v-if="canEdit"
          :model-value="row.materialPrepListIssueDate || ''"
          :loading="dateSaving"
          @change="(value) => handleDateChange(toRow(row), 'materialPrepListIssueDate', value)"
        />
        <span v-else>{{ DrawingIssuePlanForm.formatDate(row.materialPrepListIssueDate) }}</span>
      </template>
    </el-table-column>

    <el-table-column
      label="细化计划发图"
      width="120"
      align="center"
      header-align="center"
      class-name="date-column issue-date-column"
    >
      <template #default="{ row }">
        <div
          class="issue-date-cell"
          :class="getPairMeta(toRow(row).detailPlannedIssueDate, toRow(row).detailActualIssueDate).plannedDateClass"
        >
          <ProjectDateEditCell
            v-if="canEdit"
            :model-value="row.detailPlannedIssueDate || ''"
            :loading="dateSaving"
            @change="(value) => handleDateChange(toRow(row), 'detailPlannedIssueDate', value)"
          />
          <span v-else>{{ DrawingIssuePlanForm.formatDate(row.detailPlannedIssueDate) }}</span>
        </div>
      </template>
    </el-table-column>

    <el-table-column
      label="细化实际发图"
      width="120"
      align="center"
      header-align="center"
      class-name="date-column issue-date-column"
    >
      <template #default="{ row }">
        <div
          class="issue-date-cell"
          :class="getPairMeta(toRow(row).detailPlannedIssueDate, toRow(row).detailActualIssueDate).actualDateClass"
        >
          <ProjectDateEditCell
            v-if="canEdit"
            :model-value="row.detailActualIssueDate || ''"
            :loading="dateSaving"
            @change="(value) => handleDateChange(toRow(row), 'detailActualIssueDate', value)"
          />
          <span v-else>{{ DrawingIssuePlanForm.formatDate(row.detailActualIssueDate) }}</span>
        </div>
      </template>
    </el-table-column>

    <el-table-column
      label="楼承板计划发图"
      width="128"
      align="center"
      header-align="center"
      class-name="date-column issue-date-column"
    >
      <template #default="{ row }">
        <div
          class="issue-date-cell"
          :class="getPairMeta(toRow(row).floorDeckPlannedIssueDate, toRow(row).floorDeckActualIssueDate).plannedDateClass"
        >
          <ProjectDateEditCell
            v-if="canEdit"
            :model-value="row.floorDeckPlannedIssueDate || ''"
            :loading="dateSaving"
            @change="(value) => handleDateChange(toRow(row), 'floorDeckPlannedIssueDate', value)"
          />
          <span v-else>{{ DrawingIssuePlanForm.formatDate(row.floorDeckPlannedIssueDate) }}</span>
        </div>
      </template>
    </el-table-column>

    <el-table-column
      label="楼承板实际发图"
      width="128"
      align="center"
      header-align="center"
      class-name="date-column issue-date-column"
    >
      <template #default="{ row }">
        <div
          class="issue-date-cell"
          :class="getPairMeta(toRow(row).floorDeckPlannedIssueDate, toRow(row).floorDeckActualIssueDate).actualDateClass"
        >
          <ProjectDateEditCell
            v-if="canEdit"
            :model-value="row.floorDeckActualIssueDate || ''"
            :loading="dateSaving"
            @change="(value) => handleDateChange(toRow(row), 'floorDeckActualIssueDate', value)"
          />
          <span v-else>{{ DrawingIssuePlanForm.formatDate(row.floorDeckActualIssueDate) }}</span>
        </div>
      </template>
    </el-table-column>

    <el-table-column label="备注" min-width="120" class-name="text-column">
      <template #default="{ row }">
        <el-input
          v-if="canEdit"
          v-model="row.remark"
          placeholder="备注"
        />
        <span v-else>{{ row.remark || '-' }}</span>
      </template>
    </el-table-column>

    <el-table-column v-if="canEdit" label="操作" width="120" fixed="right">
      <template #default="{ row, $index }">
        <el-button type="primary" link @click="openEdit(toRow(row))">
          编辑
        </el-button>
        <el-button type="danger" link @click="emit('remove', $index)">
          删除
        </el-button>
      </template>
    </el-table-column>
  </el-table>

  <DrawingIssuePlanEditDialog
    v-model="editVisible"
    :row="editingRow"
    :project-map="projectMap"
    @save="handleEditSave"
  />
</template>

<style scoped>
.drawing-issue-plan-table :deep(.project-no-link) {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.drawing-issue-plan-table :deep(.project-no-link.is-unlinked) {
  color: var(--el-color-warning);
}

.project-no-cell {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  min-width: 0;
}

.unlink-tag {
  flex-shrink: 0;
}

.drawing-issue-plan-table :deep(.el-table__body tr.is-row-unissued > td.el-table__cell) {
  background-color: var(--el-color-primary-light-8) !important;
}

.drawing-issue-plan-table :deep(.el-table__body tr.is-row-approaching > td.el-table__cell) {
  background-color: var(--el-color-warning-light-9) !important;
}

.drawing-issue-plan-table :deep(.el-table__body tr.is-row-overdue > td.el-table__cell) {
  background-color: var(--el-color-danger-light-9) !important;
}

.drawing-issue-plan-table :deep(.el-table__body tr.is-row-unissued:hover > td.el-table__cell) {
  background-color: var(--el-color-primary-light-7) !important;
}

.drawing-issue-plan-table :deep(.el-table__body tr.is-row-approaching:hover > td.el-table__cell),
.drawing-issue-plan-table :deep(.el-table__body tr.is-row-overdue:hover > td.el-table__cell) {
  filter: brightness(0.98);
}

.issue-date-cell {
  width: 100%;
  height: 100%;
  border-radius: 4px;
}

.issue-date-cell.is-date-approaching {
  box-shadow: inset 0 0 0 1px var(--el-color-warning);
  background: rgba(230, 162, 60, 0.12);
}

.issue-date-cell.is-date-overdue {
  box-shadow: inset 0 0 0 1px var(--el-color-danger);
  background: rgba(245, 108, 108, 0.14);
}

.name-cell {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  min-width: 0;
}

.issue-tag {
  flex-shrink: 0;
}

.weight-input {
  width: 100%;
}

.weight-input :deep(.el-input__inner) {
  text-align: right;
}

.model-weight-text {
  display: inline-block;
  font-size: 13px;
  line-height: var(--biz-table-row-height, 35px);
}
</style>
