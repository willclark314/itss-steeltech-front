<script setup lang="ts">
import '@/styles/biz-data-table.css'
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchProjectList, saveDesignArea, saveDesignWorkflow, saveDetailWorkflow, saveModelWeight, updateProject } from '@/api/projects'
import DetailWorkflowDatetimeEditCell from '@/components/biz/DetailWorkflowDatetimeEditCell.vue'
import ProjectDateEditCell from '@/components/biz/ProjectDateEditCell.vue'
import LocalWorkPathCell from '@/components/biz/LocalWorkPathCell.vue'
import OverflowTooltip from '@/components/biz/OverflowTooltip.vue'
import ProjectFlowStatusEditCell from '@/components/biz/ProjectFlowStatusEditCell.vue'
import MyProjectDesignAreaCell from '@/components/portal/MyProjectDesignAreaCell.vue'
import MyProjectFlowStatusHeader from '@/components/portal/MyProjectFlowStatusHeader.vue'
import MyProjectModelWeightCell from '@/components/portal/MyProjectModelWeightCell.vue'
import { usePaginatedListCache } from '@/composables/usePaginatedListCache'
import { PAGE_SIZE_OPTIONS } from '@/constants/pagination'
import { ContactForm } from '@/models/biz/contact'
import { DesignWorkflowForm, DetailWorkflowForm, ProjectForm } from '@/models/biz/project'
import { MyProjectForm } from '@/models/portal/MyProjectForm'
import type { ProjectContactLink, ProjectNatureCode, ProjectRecord } from '@/models/biz/project'
import type {
  MyProjectDateColumnMode,
  MyProjectDesignTimeField,
  MyProjectDrawingTimeField,
  MyProjectPlateLayoutTimeField,
} from '@/models/portal/MyProjectForm'

const props = defineProps<{
  personnelId: string
  personnelTeam?: string
  personnelRoleCodes?: string[]
  highlightedProjectNo?: string
}>()

const emit = defineEmits<{
  selectContact: [contactFormId: string]
  selectProject: [project: ProjectRecord]
  clearSelection: []
  projectUpdated: [project: ProjectRecord]
  projectLeft: [projectNo: string]
}>()

const tableRef = ref()
const savingDateKey = ref('')
const savingStatusKey = ref('')
const savingModelWeightKey = ref('')
const savingDesignAreaKey = ref('')

type ProjectDateField = 'actualStartDate' | 'actualEndDate' | 'plannedEndDate'

const dateColumnMode = computed<MyProjectDateColumnMode>(() =>
  MyProjectForm.getDateColumnMode(props.personnelRoleCodes ?? [], props.personnelTeam ?? ''),
)

const showDesignAreaColumn = computed(() =>
  MyProjectForm.isDesignTeam(props.personnelTeam || ''),
)

const searchForm = reactive({
  keyword: '',
  flowFilter: [] as string[],
})

const {
  pageSize,
  filteredData,
  total,
  page,
  loading,
  loadPage,
  loadMergedFilteredPage,
  loadAroundAnchor,
  patchItem,
  getGlobalCachedItems,
} = usePaginatedListCache<ProjectRecord>({
  getItemKey: (item) => item.projectNo,
  sortList: ProjectForm.sortForDisplay,
})

function hasFlowFilter() {
  return searchForm.flowFilter.length > 0
}

function buildFilters() {
  return MyProjectForm.buildListFilters({
    keyword: searchForm.keyword,
    personnelId: props.personnelId,
    personnelTeam: props.personnelTeam || '',
    roleCodes: props.personnelRoleCodes ?? [],
    flowFilters: hasFlowFilter() ? searchForm.flowFilter : undefined,
  })
}

function getCachedMatchingFlowFiltered() {
  if (!hasFlowFilter()) return []
  return getGlobalCachedItems().filter((item) =>
    MyProjectForm.matchesFlowFilters(item, props.personnelTeam || '', searchForm.flowFilter),
  )
}

function fetchProjectPage(params: {
  keyword?: string
  assignedPersonnelId?: string
  natures?: string[]
  flowFilters?: string[]
  personnelTeam?: string
  excludeProjectNos?: string[]
  page: number
  pageSize: number
}) {
  return fetchProjectList({
    keyword: params.keyword,
    assignedPersonnelId: params.assignedPersonnelId,
    natures: params.natures,
    flowFilters: params.flowFilters,
    personnelTeam: params.personnelTeam,
    excludeProjectNos: params.excludeProjectNos,
    page: params.page,
    pageSize: params.pageSize,
  })
}

async function loadProjects(pageNo = 1, force = false) {
  try {
    const filters = buildFilters()
    if (hasFlowFilter()) {
      await loadMergedFilteredPage(
        (params) => fetchProjectPage(params),
        pageNo,
        filters,
        getCachedMatchingFlowFiltered(),
        force,
      )
      return
    }

    await loadPage(
      (params) =>
        fetchProjectList({
          keyword: params.keyword,
          assignedPersonnelId: params.assignedPersonnelId,
          natures: params.natures,
          page: params.page,
          pageSize: params.pageSize,
        }),
      pageNo,
      filters,
      force,
    )
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载项目失败')
  }
}

function handleSearch() {
  emit('clearSelection')
  void loadProjects(1, true)
}

function handleReset() {
  searchForm.keyword = ''
  searchForm.flowFilter = []
  emit('clearSelection')
  void loadProjects(1, true)
}

function handleFlowFilterChange() {
  emit('clearSelection')
  void loadProjects(1, true)
}

function handleKeywordClear() {
  if (!searchForm.keyword) return
  emit('clearSelection')
  searchForm.keyword = ''
  void loadProjects(1, true)
}

function getNatureMeta(nature: ProjectNatureCode) {
  return ProjectForm.getNatureMeta(nature)
}

function getContactLinks(row: ProjectRecord): ProjectContactLink[] {
  return ProjectForm.getContactLinks(row)
}

function getContactLinkLabel(link: ProjectContactLink, row: ProjectRecord) {
  return ContactForm.formatDisplayId(link.contactFormId, ProjectForm.getDisplayProjectNo(row))
}

function toProjectRecord(row: unknown): ProjectRecord {
  return row as ProjectRecord
}

function getRowClassName({ row }: { row: ProjectRecord }) {
  if (!props.highlightedProjectNo) return ''
  return ProjectForm.getDisplayProjectNo(row) === props.highlightedProjectNo ? 'is-highlighted' : ''
}

function scrollToProject(projectNo: string) {
  const displayNo = ProjectForm.parseBaseProjectNo(projectNo)
  if (!filteredData.value.some((item) => ProjectForm.getDisplayProjectNo(item) === displayNo)) {
    return
  }

  nextTick(() => {
    const row = tableRef.value?.$el?.querySelector('.el-table__body .el-table__row.is-highlighted')
    row?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  })
}

async function focusProject(projectNo: string) {
  const displayNo = ProjectForm.parseBaseProjectNo(projectNo)
  const filters = buildFilters()

  const exists = filteredData.value.some(
    (item) => ProjectForm.getDisplayProjectNo(item) === displayNo,
  )

  if (!exists) {
    try {
      await loadAroundAnchor(
        (params) =>
          fetchProjectList({
            keyword: params.keyword,
            assignedPersonnelId: params.assignedPersonnelId,
            natures: params.natures,
            flowFilters: params.flowFilters,
            personnelTeam: params.personnelTeam,
            anchor: params.anchor,
            pageSize: params.pageSize,
          }),
        projectNo,
        filters,
        true,
      )
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '定位项目失败')
      return
    }
  }
  scrollToProject(projectNo)
}

function handleContactClick(contactFormId: string) {
  emit('selectContact', contactFormId)
}

function handleProjectNoClick(row: ProjectRecord) {
  emit('selectProject', row)
}

function isDateSaving(projectNo: string, field: ProjectDateField) {
  return savingDateKey.value === `${projectNo}:${field}`
}

function isDrawingTimeSaving(projectNo: string, field: MyProjectDrawingTimeField) {
  return savingDateKey.value === `${projectNo}:${field}`
}

function isDrawingTimeApplicable(row: ProjectRecord) {
  return DetailWorkflowForm.needsDetailWorkflow(row.natures) && Boolean(row.detailWorkflow)
}

function getDrawingTimeValue(row: ProjectRecord, field: MyProjectDrawingTimeField) {
  return DetailWorkflowForm.normalizeYearMonth(row.detailWorkflow?.[field])
}

function isDrawingTimeEditable(row: ProjectRecord, field: MyProjectDrawingTimeField) {
  if (!row.detailWorkflow) return false
  const timeKind = field === 'drawingStartedAt' ? 'started' : 'completed'
  return DetailWorkflowForm.isTimeFieldEnabled(row.detailWorkflow.drawingStatus, timeKind)
}

function isPlateLayoutTimeSaving(projectNo: string, field: MyProjectPlateLayoutTimeField) {
  return savingDateKey.value === `${projectNo}:${field}`
}

function isPlateLayoutTimeApplicable(row: ProjectRecord) {
  return (
    DetailWorkflowForm.hasPlateLayoutPhase(row.detailWorkflow) && Boolean(row.detailWorkflow)
  )
}

function getPlateLayoutTimeValue(row: ProjectRecord, field: MyProjectPlateLayoutTimeField) {
  return (row.detailWorkflow?.[field] || '').trim()
}

function isPlateLayoutTimeEditable(row: ProjectRecord, field: MyProjectPlateLayoutTimeField) {
  if (!row.detailWorkflow) return false
  const timeKind = field === 'plateLayoutStartedAt' ? 'started' : 'completed'
  return DetailWorkflowForm.isTimeFieldEnabled(row.detailWorkflow.plateLayoutStatus, timeKind)
}

function isDesignTimeSaving(projectNo: string, field: MyProjectDesignTimeField) {
  return savingDateKey.value === `${projectNo}:${field}`
}

function isDesignTimeApplicable(row: ProjectRecord) {
  return DesignWorkflowForm.needsDesignWorkflow(row.natures) && Boolean(row.designWorkflow)
}

function getDesignTimeValue(row: ProjectRecord, field: MyProjectDesignTimeField) {
  return (row.designWorkflow?.[field] || '').trim()
}

function handleStatusSaving(key: string) {
  savingStatusKey.value = key
}

function handleStatusSaved(key: string) {
  if (savingStatusKey.value === key) {
    savingStatusKey.value = ''
  }
}

function handleStatusUpdated(row: ProjectRecord, updated: ProjectRecord) {
  patchItem(row.projectNo, () => updated)

  if (
    hasFlowFilter() &&
    !MyProjectForm.matchesFlowFilters(updated, props.personnelTeam || '', searchForm.flowFilter)
  ) {
    void loadProjects(page.value, true)
  }

  emit('projectUpdated', updated)
}

function handlePathUpdated(
  projectNo: string,
  localWorkPath: string,
  designWorkPath: string,
  detailWorkPath: string,
) {
  patchItem(projectNo, (item) => ({
    ...item,
    localWorkPath,
    designWorkPath,
    detailWorkPath,
  }))

  const updated = filteredData.value.find((item) => item.projectNo === projectNo)
  if (!updated) return

  emit('projectUpdated', updated as ProjectRecord)
}

async function handleDateChange(row: ProjectRecord, field: ProjectDateField, value: string) {
  const savingKey = `${row.projectNo}:${field}`
  savingDateKey.value = savingKey
  try {
    const updated = await updateProject(row.projectNo, { [field]: value })
    patchItem(row.projectNo, () => updated)
    emit('projectUpdated', updated)
    ElMessage.success('日期已保存')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存日期失败')
  } finally {
    if (savingDateKey.value === savingKey) {
      savingDateKey.value = ''
    }
  }
}

async function handleDrawingTimeChange(
  row: ProjectRecord,
  field: MyProjectDrawingTimeField,
  value: string,
) {
  if (!row.detailWorkflow) return
  const savingKey = `${row.projectNo}:${field}`
  savingDateKey.value = savingKey
  try {
    const updated = await saveDetailWorkflow(
      row.projectNo,
      DetailWorkflowForm.buildDrawingTimeSavePayload(row.detailWorkflow, field, value),
    )
    patchItem(row.projectNo, () => updated)
    emit('projectUpdated', updated)
    ElMessage.success('调图年月已保存')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存调图年月失败')
  } finally {
    if (savingDateKey.value === savingKey) {
      savingDateKey.value = ''
    }
  }
}

async function handlePlateLayoutTimeChange(
  row: ProjectRecord,
  field: MyProjectPlateLayoutTimeField,
  value: string,
) {
  if (!row.detailWorkflow) return
  const savingKey = `${row.projectNo}:${field}`
  savingDateKey.value = savingKey
  try {
    const updated = await saveDetailWorkflow(
      row.projectNo,
      DetailWorkflowForm.buildPlateLayoutTimeSavePayload(row.detailWorkflow, field, value),
    )
    patchItem(row.projectNo, () => updated)
    emit('projectUpdated', updated)
    ElMessage.success('排板时间已保存')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存排板时间失败')
  } finally {
    if (savingDateKey.value === savingKey) {
      savingDateKey.value = ''
    }
  }
}

async function handleDesignTimeChange(
  row: ProjectRecord,
  field: MyProjectDesignTimeField,
  value: string,
) {
  if (!row.designWorkflow) return
  const savingKey = `${row.projectNo}:${field}`
  savingDateKey.value = savingKey
  try {
    const updated = await saveDesignWorkflow(
      row.projectNo,
      DesignWorkflowForm.buildTimeSavePayload(row.designWorkflow, field, value),
    )
    patchItem(row.projectNo, () => updated)
    emit('projectUpdated', updated)
    ElMessage.success('设计日期已保存')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存设计日期失败')
  } finally {
    if (savingDateKey.value === savingKey) {
      savingDateKey.value = ''
    }
  }
}

async function handleModelWeightChange(row: ProjectRecord, value: number | null) {
  const savingKey = row.projectNo
  savingModelWeightKey.value = savingKey
  try {
    const updated = await saveModelWeight(row.projectNo, value)
    patchItem(row.projectNo, () => updated)
    emit('projectUpdated', updated)
    ElMessage.success('模型重量已保存')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存模型重量失败')
  } finally {
    if (savingModelWeightKey.value === savingKey) {
      savingModelWeightKey.value = ''
    }
  }
}

async function handleDesignAreaChange(row: ProjectRecord, value: number | null) {
  const savingKey = row.projectNo
  savingDesignAreaKey.value = savingKey
  try {
    const updated = await saveDesignArea(row.projectNo, value)
    patchItem(row.projectNo, () => updated)
    emit('projectUpdated', updated)
    ElMessage.success('设计面积已保存')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存设计面积失败')
  } finally {
    if (savingDesignAreaKey.value === savingKey) {
      savingDesignAreaKey.value = ''
    }
  }
}

function handlePageChange(pageNo: number) {
  emit('clearSelection')
  void loadProjects(pageNo)
}

function handleSizeChange() {
  emit('clearSelection')
  void loadProjects(1)
}

defineExpose({ focusProject })

watch(
  () => props.personnelId,
  (nextId, prevId) => {
    if (!nextId || nextId === prevId) return
    searchForm.keyword = ''
    searchForm.flowFilter = []
    emit('clearSelection')
    void loadProjects(1, true)
  },
)

onMounted(() => {
  void loadProjects(1)
})
</script>

<template>
  <section class="my-section my-section--project">
    <div class="my-section__header">
      <div class="my-section__header-main">
        <span class="my-section__title">我的项目</span>
        <div class="my-section__search">
          <el-input v-model="searchForm.keyword" placeholder="项目号 / 名称 / 联系单号" clearable size="small"
            @keyup.enter="handleSearch" @clear="handleKeywordClear" />
          <el-button type="primary" size="small" @click="handleSearch">查询</el-button>
          <el-button size="small" @click="handleReset">重置</el-button>
        </div>
      </div>
      <span class="my-section__total">共 {{ total }} 条</span>
    </div>

    <div class="my-section__table-wrap">
      <el-table ref="tableRef" v-loading="loading" :data="filteredData" stripe class="biz-data-table my-project-table"
        :row-class-name="getRowClassName" height="100%" size="small">
        <el-table-column label="联系单编号" width="200" class-name="tag-column contact-form-column">
          <template #default="{ row }">
            <div v-if="getContactLinks(toProjectRecord(row)).length" class="contact-form-tag-list">
              <OverflowTooltip v-for="link in getContactLinks(toProjectRecord(row))"
                :key="`${link.projectNo}:${link.contactFormId}`"
                :content="getContactLinkLabel(link, toProjectRecord(row))">
                <el-tag type="success" size="small" class="cell-tag cell-tag--clickable"
                  @click.stop="handleContactClick(link.contactFormId)">
                  {{ getContactLinkLabel(link, toProjectRecord(row)) }}
                </el-tag>
              </OverflowTooltip>
            </div>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="项目号" width="150" class-name="tag-column project-no-column">
          <template #default="{ row }">
            <OverflowTooltip :content="ProjectForm.getDisplayProjectNo(toProjectRecord(row))">
              <el-tag type="primary" effect="plain" size="small" class="cell-tag cell-tag--clickable"
                @click.stop="handleProjectNoClick(toProjectRecord(row))">
                {{ ProjectForm.getDisplayProjectNo(toProjectRecord(row)) }}
              </el-tag>
            </OverflowTooltip>
          </template>
        </el-table-column>
        <el-table-column label="项目名称" min-width="140" class-name="text-column">
          <template #default="{ row }">
            <OverflowTooltip v-if="toProjectRecord(row).name" :content="toProjectRecord(row).name">
              <span class="ellipsis-cell">{{ toProjectRecord(row).name }}</span>
            </OverflowTooltip>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="项目性质" width="110" class-name="tag-column nature-column">
          <template #default="{ row }">
            <div class="nature-cell" :class="{ 'is-empty': !toProjectRecord(row).natures.length }">
              <div v-if="toProjectRecord(row).natures.length" class="nature-tag-list">
                <el-tag v-for="nature in toProjectRecord(row).natures" :key="nature" :type="getNatureMeta(nature)!.type"
                  size="small" class="cell-tag">
                  {{ getNatureMeta(nature)!.label }}
                </el-tag>
              </div>
              <span v-else class="text-muted">-</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column width="200" class-name="tag-column">
          <template #header>
            <MyProjectFlowStatusHeader v-model="searchForm.flowFilter" :personnel-team="personnelTeam || ''"
              @change="handleFlowFilterChange" />
          </template>
          <template #default="{ row }">
            <ProjectFlowStatusEditCell
              :project="toProjectRecord(row)"
              :personnel-team="personnelTeam || ''"
              :full-edit-access="false"
              :loading-key="savingStatusKey"
              @updated="(updated) => handleStatusUpdated(toProjectRecord(row), updated)"
              @saving="handleStatusSaving"
              @saved="handleStatusSaved"
            />
          </template>
        </el-table-column>
        <el-table-column
          v-if="showDesignAreaColumn"
          label="设计面积(㎡)"
          width="96"
          align="center"
          header-align="center"
          class-name="design-area-column"
        >
          <template #default="{ row }">
            <MyProjectDesignAreaCell
              :project="toProjectRecord(row)"
              :personnel-team="personnelTeam || ''"
              :loading="savingDesignAreaKey === toProjectRecord(row).projectNo"
              @change="(value) => handleDesignAreaChange(toProjectRecord(row), value)"
            />
          </template>
        </el-table-column>
        <el-table-column
          v-else
          label="模型重量(吨)"
          width="96"
          align="center"
          header-align="center"
          class-name="model-weight-column"
        >
          <template #default="{ row }">
            <MyProjectModelWeightCell :project="toProjectRecord(row)" :personnel-team="personnelTeam || ''"
              :loading="savingModelWeightKey === toProjectRecord(row).projectNo"
              @change="(value) => handleModelWeightChange(toProjectRecord(row), value)" />
          </template>
        </el-table-column>
        <template v-if="dateColumnMode === 'drawing'">
          <el-table-column label="调图开始" width="108" align="center" class-name="date-column">
            <template #default="{ row }">
              <template v-if="isDrawingTimeApplicable(toProjectRecord(row))">
                <ProjectDateEditCell
                  type="month"
                  :model-value="getDrawingTimeValue(toProjectRecord(row), 'drawingStartedAt')"
                  :loading="isDrawingTimeSaving(toProjectRecord(row).projectNo, 'drawingStartedAt')"
                  :disabled="!isDrawingTimeEditable(toProjectRecord(row), 'drawingStartedAt')"
                  @change="(value) => handleDrawingTimeChange(toProjectRecord(row), 'drawingStartedAt', value)" />
              </template>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
          <el-table-column label="调图结束" width="108" align="center" class-name="date-column">
            <template #default="{ row }">
              <template v-if="isDrawingTimeApplicable(toProjectRecord(row))">
                <ProjectDateEditCell
                  type="month"
                  :model-value="getDrawingTimeValue(toProjectRecord(row), 'drawingCompletedAt')"
                  :loading="isDrawingTimeSaving(toProjectRecord(row).projectNo, 'drawingCompletedAt')"
                  :disabled="!isDrawingTimeEditable(toProjectRecord(row), 'drawingCompletedAt')"
                  @change="(value) => handleDrawingTimeChange(toProjectRecord(row), 'drawingCompletedAt', value)" />
              </template>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
        </template>
        <template v-else-if="dateColumnMode === 'plate_layout'">
          <el-table-column label="排板开始" width="108" align="center" class-name="date-column">
            <template #default="{ row }">
              <template v-if="isPlateLayoutTimeApplicable(toProjectRecord(row))">
                <DetailWorkflowDatetimeEditCell
                  :model-value="getPlateLayoutTimeValue(toProjectRecord(row), 'plateLayoutStartedAt')"
                  :loading="isPlateLayoutTimeSaving(toProjectRecord(row).projectNo, 'plateLayoutStartedAt')"
                  :disabled="!isPlateLayoutTimeEditable(toProjectRecord(row), 'plateLayoutStartedAt')"
                  @change="(value) => handlePlateLayoutTimeChange(toProjectRecord(row), 'plateLayoutStartedAt', value)" />
              </template>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
          <el-table-column label="排板结束" width="108" align="center" class-name="date-column">
            <template #default="{ row }">
              <template v-if="isPlateLayoutTimeApplicable(toProjectRecord(row))">
                <DetailWorkflowDatetimeEditCell
                  :model-value="getPlateLayoutTimeValue(toProjectRecord(row), 'plateLayoutCompletedAt')"
                  :loading="isPlateLayoutTimeSaving(toProjectRecord(row).projectNo, 'plateLayoutCompletedAt')"
                  :disabled="!isPlateLayoutTimeEditable(toProjectRecord(row), 'plateLayoutCompletedAt')"
                  @change="(value) => handlePlateLayoutTimeChange(toProjectRecord(row), 'plateLayoutCompletedAt', value)" />
              </template>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
        </template>
        <template v-else-if="dateColumnMode === 'design'">
          <el-table-column label="设计开始" width="108" align="center" class-name="date-column">
            <template #default="{ row }">
              <template v-if="isDesignTimeApplicable(toProjectRecord(row))">
                <ProjectDateEditCell
                  :model-value="getDesignTimeValue(toProjectRecord(row), 'designStartedAt')"
                  :loading="isDesignTimeSaving(toProjectRecord(row).projectNo, 'designStartedAt')"
                  @change="(value) => handleDesignTimeChange(toProjectRecord(row), 'designStartedAt', value)" />
              </template>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
          <el-table-column label="设计结束" width="108" align="center" class-name="date-column">
            <template #default="{ row }">
              <template v-if="isDesignTimeApplicable(toProjectRecord(row))">
                <ProjectDateEditCell
                  :model-value="getDesignTimeValue(toProjectRecord(row), 'designCompletedAt')"
                  :loading="isDesignTimeSaving(toProjectRecord(row).projectNo, 'designCompletedAt')"
                  @change="(value) => handleDesignTimeChange(toProjectRecord(row), 'designCompletedAt', value)" />
              </template>
              <span v-else class="text-muted">-</span>
            </template>
          </el-table-column>
        </template>
        <template v-else>
          <el-table-column label="实际开始" width="108" align="center" class-name="date-column">
            <template #default="{ row }">
              <ProjectDateEditCell :model-value="toProjectRecord(row).actualStartDate"
                :loading="isDateSaving(toProjectRecord(row).projectNo, 'actualStartDate')"
                @change="(value) => handleDateChange(toProjectRecord(row), 'actualStartDate', value)" />
            </template>
          </el-table-column>
          <el-table-column label="实际完成" width="108" align="center" class-name="date-column">
            <template #default="{ row }">
              <ProjectDateEditCell :model-value="toProjectRecord(row).actualEndDate"
                :loading="isDateSaving(toProjectRecord(row).projectNo, 'actualEndDate')"
                @change="(value) => handleDateChange(toProjectRecord(row), 'actualEndDate', value)" />
            </template>
          </el-table-column>
        </template>
        <el-table-column label="本地路径" width="72" align="center" header-align="center" class-name="local-path-column">
          <template #default="{ row }">
            <LocalWorkPathCell
              :project="toProjectRecord(row)"
              activate-on-interact
              @path-updated="handlePathUpdated"
            />
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="my-section__pagination">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :page-sizes="[...PAGE_SIZE_OPTIONS]"
        :total="total"
        layout="total, sizes, prev, pager, next"
        background
        small
        @size-change="handleSizeChange"
        @current-change="handlePageChange"
      />
    </div>
  </section>
</template>

<style scoped>
.my-section {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
}

.my-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 6px;
  flex-shrink: 0;
}

.my-section__header-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.my-section__search {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
  max-width: 300px;
}

.my-section__search .el-input {
  flex: 1;
  min-width: 0;
}

.my-section__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.my-section__total {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  white-space: nowrap;
}

.my-section__table-wrap {
  height: var(--my-table-height, 392px);
  overflow: hidden;
}

.my-section__table-wrap :deep(.el-table) {
  height: 100%;
}

.my-section__pagination {
  display: flex;
  justify-content: flex-end;
  margin-top: 6px;
  flex-shrink: 0;
}

.nature-cell {
  display: flex;
  align-items: center;
  width: 100%;
  height: var(--biz-table-row-height, 35px);
}

.nature-cell.is-empty {
  padding-left: 2px;
}

.ellipsis-cell {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  color: var(--el-text-color-regular);
}
</style>
