<script setup lang="ts">
import '@/styles/biz-data-table.css'
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchProjectList } from '@/api/projects'
import { DesignDrawingIssuePlanForm } from '@/models/biz/designDrawingIssuePlan/DesignDrawingIssuePlanForm'
import { ProjectForm } from '@/models/biz/project'
import type { ProjectRecord } from '@/models/biz/project'

const props = defineProps<{
  visible: boolean
  excludedProjectNos?: string[]
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  confirm: [projects: ProjectRecord[]]
}>()

const loading = ref(false)
const projects = ref<ProjectRecord[]>([])
const selectedRows = ref<ProjectRecord[]>([])

const searchForm = reactive({
  keyword: '',
  status: 'active',
})

const statusOptions = ProjectForm.STATUS_OPTIONS.filter((item) => item.value !== 'done')

const dialogVisible = computed({
  get: () => props.visible,
  set: (value: boolean) => emit('update:visible', value),
})

const excludedSet = computed(() => {
  const set = new Set<string>()
  for (const projectNo of props.excludedProjectNos || []) {
    const normalized = projectNo.trim().toUpperCase()
    if (normalized) set.add(normalized)
  }
  return set
})

const selectableProjects = computed(() =>
  projects.value.filter(
    (project) =>
      DesignDrawingIssuePlanForm.isEligibleProject(project) &&
      !excludedSet.value.has(project.projectNo.trim().toUpperCase()),
  ),
)

watch(
  () => props.visible,
  (visible) => {
    if (!visible) return
    selectedRows.value = []
    searchForm.keyword = ''
    searchForm.status = 'active'
    void loadProjects()
  },
)

async function loadProjects() {
  loading.value = true
  try {
    const result = await fetchProjectList({
      keyword: searchForm.keyword.trim() || undefined,
      status: searchForm.status || undefined,
      all: true,
    })
    projects.value = ProjectForm.sortForDisplay(result.list)
  } catch (error) {
    projects.value = []
    ElMessage.error(error instanceof Error ? error.message : '加载项目失败')
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  void loadProjects()
}

function handleReset() {
  searchForm.keyword = ''
  searchForm.status = 'active'
  void loadProjects()
}

function handleSelectionChange(rows: ProjectRecord[]) {
  selectedRows.value = rows
}

function handleConfirm() {
  if (!selectedRows.value.length) {
    ElMessage.warning('请至少选择一个项目')
    return
  }
  emit('confirm', [...selectedRows.value])
  dialogVisible.value = false
}

function getNatureLabels(row: ProjectRecord) {
  return DesignDrawingIssuePlanForm.ELIGIBLE_NATURES.filter((nature) =>
    row.natures.includes(nature),
  )
    .map((nature) => ProjectForm.getNatureLabel(nature))
    .join('、')
}

function isSelectable(row: ProjectRecord) {
  return (
    DesignDrawingIssuePlanForm.isEligibleProject(row) &&
    !excludedSet.value.has(row.projectNo.trim().toUpperCase())
  )
}

function toProjectRecord(row: unknown): ProjectRecord {
  return row as ProjectRecord
}
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    title="添加项目到设计发图计划"
    width="960px"
    destroy-on-close
    class="design-drawing-issue-plan-picker-dialog"
  >
    <div class="picker-toolbar">
      <el-form :inline="true" :model="searchForm" class="picker-form">
        <el-form-item label="关键词">
          <el-input
            v-model="searchForm.keyword"
            placeholder="项目号 / 名称 / 联系单编号"
            clearable
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="流程状态">
          <el-select v-model="searchForm.status" placeholder="全部" style="width: 120px">
            <el-option
              v-for="item in statusOptions"
              :key="item.value || 'all'"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
      <span class="picker-summary">
        可选 {{ selectableProjects.length }} 项，已选 {{ selectedRows.length }} 项
      </span>
    </div>
    <p class="picker-hint">本页维护：设计发图、排瓦发图、排楼承板发图（每个项目一行，独立时间字段）</p>

    <el-table
      v-loading="loading"
      :data="selectableProjects"
      stripe
      class="biz-data-table picker-table"
      height="420px"
      @selection-change="handleSelectionChange"
    >
      <el-table-column type="selection" width="48" :selectable="isSelectable" />
      <el-table-column label="项目号" width="110" class-name="text-column">
        <template #default="{ row }">
          {{ ProjectForm.getDisplayProjectNo(toProjectRecord(row)) }}
        </template>
      </el-table-column>
      <el-table-column prop="name" label="项目名称" min-width="200" show-overflow-tooltip />
      <el-table-column label="相关性质" min-width="140" show-overflow-tooltip>
        <template #default="{ row }">
          {{ getNatureLabels(toProjectRecord(row)) || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="计划结束" width="100" align="center" header-align="center" class-name="date-column">
        <template #default="{ row }">
          {{ toProjectRecord(row).plannedEndDate || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="是否发图" width="88" align="center" header-align="center">
        <template #default="{ row }">
          {{ toProjectRecord(row).drawingIssueEnabled ? '是' : '否' }}
        </template>
      </el-table-column>
      <el-table-column label="发图年月" width="100" align="center" header-align="center" class-name="date-column">
        <template #default="{ row }">
          {{ ProjectForm.formatDrawingIssueYearMonth(toProjectRecord(row).drawingIssueYearMonth) }}
        </template>
      </el-table-column>
    </el-table>

    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :disabled="!selectedRows.length" @click="handleConfirm">
        添加到设计发图计划
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.picker-toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.picker-form {
  flex: 1;
  min-width: 0;
}

.picker-summary {
  flex-shrink: 0;
  font-size: 13px;
  line-height: 32px;
  color: var(--el-text-color-secondary);
}

.picker-hint {
  margin: 0 0 12px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
}

.picker-table {
  width: 100%;
}
</style>
