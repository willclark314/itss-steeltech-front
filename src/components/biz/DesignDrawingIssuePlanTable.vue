<script setup lang="ts">
import '@/styles/biz-data-table.css'
import '@/styles/project-no-info-message.css'
import { ElMessage } from 'element-plus'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import DesignDrawingIssuePlanEditDialog from '@/components/biz/DesignDrawingIssuePlanEditDialog.vue'
import ProjectDateEditCell from '@/components/biz/ProjectDateEditCell.vue'
import ProjectPersonnelCell from '@/components/biz/ProjectPersonnelCell.vue'
import {
  DesignDrawingIssuePlanForm,
  type DesignDrawingIssuePlanEditForm,
  type DesignDrawingIssuePlanRow,
} from '@/models/biz/designDrawingIssuePlan/DesignDrawingIssuePlanForm'
import { ProjectForm } from '@/models/biz/project'
import type { ProjectRecord } from '@/models/biz/project'
import { copyProjectNoAndShowInfo } from '@/utils/projectNoMessage'

type DateField =
  | 'designPlannedIssueDate'
  | 'designActualIssueDate'
  | 'tileLayoutPlannedIssueDate'
  | 'tileLayoutActualIssueDate'
  | 'floorDeckPlannedIssueDate'
  | 'floorDeckActualIssueDate'

const props = withDefaults(
  defineProps<{
    data: DesignDrawingIssuePlanRow[]
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
const editingRow = ref<DesignDrawingIssuePlanRow | null>(null)

function openEdit(row: DesignDrawingIssuePlanRow) {
  editingRow.value = row
  editVisible.value = true
}

function handleEditSave(form: DesignDrawingIssuePlanEditForm) {
  if (!editingRow.value) return

  const linked = props.projectMap
    ? DesignDrawingIssuePlanForm.resolveLinkedProject(form.projectNo, props.projectMap)
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

  if (props.projectMap && !DesignDrawingIssuePlanForm.resolveLinkedProject(form.projectNo, props.projectMap)) {
    ElMessage.warning('请从项目库中选择有效的项目号')
    return
  }

  Object.assign(
    editingRow.value,
    DesignDrawingIssuePlanForm.applyEditForm(editingRow.value, form, props.projectMap),
  )
  editVisible.value = false
}

async function handleProjectNoClick(row: DesignDrawingIssuePlanRow) {
  await copyProjectNoAndShowInfo(router, {
    projectNo: row.projectNo,
    projectName: row.projectName,
    linkedProject: row.linkedProject,
  })
}

function getRowMeta(row: DesignDrawingIssuePlanRow) {
  return DesignDrawingIssuePlanForm.getRowStateMeta(row, new Date(), {
    approachingDays: props.approachingDays,
  })
}

function getPairMeta(planned: string | null | undefined, actual: string | null | undefined) {
  return DesignDrawingIssuePlanForm.getDatePairMeta(planned, actual, new Date(), {
    approachingDays: props.approachingDays,
  })
}

function getRowClassName({ row }: { row: DesignDrawingIssuePlanRow }) {
  return getRowMeta(row).rowClass
}

function isProjectLinked(row: DesignDrawingIssuePlanRow) {
  return Boolean(row.linkedProject)
}

function getProjectNoDisplay(row: DesignDrawingIssuePlanRow) {
  if (row.linkedProject) {
    return ProjectForm.getDisplayProjectNo(row.linkedProject)
  }
  return row.projectNo || '-'
}

function toRow(row: unknown): DesignDrawingIssuePlanRow {
  return row as DesignDrawingIssuePlanRow
}

function handleDateChange(row: DesignDrawingIssuePlanRow, field: DateField, value: string) {
  row[field] = value || null
  emit('date-change')
}
</script>

<template>
  <el-table
    v-loading="loading"
    :data="data"
    stripe
    class="biz-data-table design-drawing-issue-plan-table"
    :height="tableHeight"
    :row-class-name="getRowClassName"
    style="width: 100%"
    empty-text="本月暂无设计发图计划"
  >
    <el-table-column label="序号" width="64" fixed="left" align="center" header-align="center">
      <template #default="{ $index }">
        {{ $index + 1 }}
      </template>
    </el-table-column>

    <el-table-column label="项目号" width="148" fixed="left" class-name="text-column project-no-column">
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

    <el-table-column label="项目名称" min-width="220" fixed="left" show-overflow-tooltip class-name="text-column">
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

    <el-table-column label="分配人员" width="100" fixed="left" class-name="tag-column personnel-column">
      <template #default="{ row }">
        <ProjectPersonnelCell :personnel="toRow(row).linkedProject?.assignedPersonnel || []" />
      </template>
    </el-table-column>

    <el-table-column label="设计计划发图" width="120" align="center" header-align="center" class-name="date-column issue-date-column">
      <template #default="{ row }">
        <div
          class="issue-date-cell"
          :class="getPairMeta(toRow(row).designPlannedIssueDate, toRow(row).designActualIssueDate).plannedDateClass"
        >
          <ProjectDateEditCell
            v-if="canEdit"
            :model-value="row.designPlannedIssueDate || ''"
            :loading="dateSaving"
            @change="(value) => handleDateChange(toRow(row), 'designPlannedIssueDate', value)"
          />
          <span v-else>{{ DesignDrawingIssuePlanForm.formatDate(row.designPlannedIssueDate) }}</span>
        </div>
      </template>
    </el-table-column>
    <el-table-column label="设计实际发图" width="120" align="center" header-align="center" class-name="date-column issue-date-column">
      <template #default="{ row }">
        <div
          class="issue-date-cell"
          :class="getPairMeta(toRow(row).designPlannedIssueDate, toRow(row).designActualIssueDate).actualDateClass"
        >
          <ProjectDateEditCell
            v-if="canEdit"
            :model-value="row.designActualIssueDate || ''"
            :loading="dateSaving"
            @change="(value) => handleDateChange(toRow(row), 'designActualIssueDate', value)"
          />
          <span v-else>{{ DesignDrawingIssuePlanForm.formatDate(row.designActualIssueDate) }}</span>
        </div>
      </template>
    </el-table-column>

    <el-table-column label="排瓦计划发图" width="120" align="center" header-align="center" class-name="date-column issue-date-column">
      <template #default="{ row }">
        <div
          class="issue-date-cell"
          :class="getPairMeta(toRow(row).tileLayoutPlannedIssueDate, toRow(row).tileLayoutActualIssueDate).plannedDateClass"
        >
          <ProjectDateEditCell
            v-if="canEdit"
            :model-value="row.tileLayoutPlannedIssueDate || ''"
            :loading="dateSaving"
            @change="(value) => handleDateChange(toRow(row), 'tileLayoutPlannedIssueDate', value)"
          />
          <span v-else>{{ DesignDrawingIssuePlanForm.formatDate(row.tileLayoutPlannedIssueDate) }}</span>
        </div>
      </template>
    </el-table-column>
    <el-table-column label="排瓦实际发图" width="120" align="center" header-align="center" class-name="date-column issue-date-column">
      <template #default="{ row }">
        <div
          class="issue-date-cell"
          :class="getPairMeta(toRow(row).tileLayoutPlannedIssueDate, toRow(row).tileLayoutActualIssueDate).actualDateClass"
        >
          <ProjectDateEditCell
            v-if="canEdit"
            :model-value="row.tileLayoutActualIssueDate || ''"
            :loading="dateSaving"
            @change="(value) => handleDateChange(toRow(row), 'tileLayoutActualIssueDate', value)"
          />
          <span v-else>{{ DesignDrawingIssuePlanForm.formatDate(row.tileLayoutActualIssueDate) }}</span>
        </div>
      </template>
    </el-table-column>

    <el-table-column label="楼承板计划发图" width="128" align="center" header-align="center" class-name="date-column issue-date-column">
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
          <span v-else>{{ DesignDrawingIssuePlanForm.formatDate(row.floorDeckPlannedIssueDate) }}</span>
        </div>
      </template>
    </el-table-column>
    <el-table-column label="楼承板实际发图" width="128" align="center" header-align="center" class-name="date-column issue-date-column">
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
          <span v-else>{{ DesignDrawingIssuePlanForm.formatDate(row.floorDeckActualIssueDate) }}</span>
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

  <DesignDrawingIssuePlanEditDialog
    v-model="editVisible"
    :row="editingRow"
    :project-map="projectMap"
    @save="handleEditSave"
  />
</template>

<style scoped>
.design-drawing-issue-plan-table :deep(.project-no-link) {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.design-drawing-issue-plan-table :deep(.project-no-link.is-unlinked) {
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

.design-drawing-issue-plan-table :deep(.el-table__body tr.is-row-unissued > td.el-table__cell) {
  background-color: var(--el-color-primary-light-8) !important;
}

.design-drawing-issue-plan-table :deep(.el-table__body tr.is-row-approaching > td.el-table__cell) {
  background-color: var(--el-color-warning-light-9) !important;
}

.design-drawing-issue-plan-table :deep(.el-table__body tr.is-row-overdue > td.el-table__cell) {
  background-color: var(--el-color-danger-light-9) !important;
}

.design-drawing-issue-plan-table :deep(.el-table__body tr.is-row-unissued:hover > td.el-table__cell) {
  background-color: var(--el-color-primary-light-7) !important;
}

.design-drawing-issue-plan-table :deep(.el-table__body tr.is-row-approaching:hover > td.el-table__cell),
.design-drawing-issue-plan-table :deep(.el-table__body tr.is-row-overdue:hover > td.el-table__cell) {
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
</style>
