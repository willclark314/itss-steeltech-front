<script setup lang="ts">
import '@/styles/biz-page-card.css'
import { computed, defineAsyncComponent, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus'
import { copyProject, createProject, deleteProject, fetchProjectList, splitProject, updateProject } from '@/api/projects'
import { fetchPersonnelList } from '@/api/personnel'
import ProjectTable from '@/components/biz/ProjectTable.vue'
import TagSelect from '@/components/biz/TagSelect.vue'
import { DetailWorkflowForm, ProjectForm } from '@/models/biz/project'
import { ProjectWorkPath } from '@/models/biz/ProjectWorkPath'
import { fetchSystemConfig } from '@/api/system'
import { BusinessSystemConfig } from '@/models/biz'
import type { LocalWorkPathConfig } from '@/models/biz'
import type { PersonnelRecord } from '@/models/personnel'
import type {
  ProjectAssignee,
  ProjectNatureCode,
  ProjectRecord,
} from '@/models/biz/project'
import { BIZ_ROUTES } from '@/models/biz/navigation'
import { usePaginatedListCache } from '@/composables/usePaginatedListCache'
import { PAGE_SIZE_OPTIONS } from '@/constants/pagination'

/** 编辑弹窗内重组件按需加载，避免挤进项目管理首屏 chunk */
const PersonnelAssignSelect = defineAsyncComponent(
  () => import('@/components/biz/PersonnelAssignSelect.vue'),
)
const ProjectDetailWorkflowPanel = defineAsyncComponent(
  () => import('@/components/biz/ProjectDetailWorkflowPanel.vue'),
)
const ProjectContactFormSelect = defineAsyncComponent(
  () => import('@/components/biz/ProjectContactFormSelect.vue'),
)

const route = useRoute()
const router = useRouter()
const submitting = ref(false)
const splitting = ref(false)
const projectTableRef = ref<InstanceType<typeof ProjectTable>>()
const highlightedProjectNo = ref('')
const editingProjectNo = ref<string | null>(null)
const copySourceNo = ref<string | null>(null)
type DialogMode = 'create' | 'edit' | 'copy'
const dialogMode = ref<DialogMode>('create')
const editingRecord = ref<ProjectRecord | null>(null)
const dialogVisible = ref(false)
const formRef = ref<FormInstance>()
const form = reactive(ProjectForm.createEmptyForm())
const naturesSnapshot = ref<ProjectNatureCode[]>([])
function syncNaturesSnapshot() {
  naturesSnapshot.value = [...form.natures]
}

function isSameNatures(left: ProjectNatureCode[], right: ProjectNatureCode[]) {
  if (left.length !== right.length) return false
  return left.every((item) => right.includes(item))
}

function syncWorkPathsForNatureChange() {
  const nextNatures = [...form.natures]
  if (isSameNatures(nextNatures, naturesSnapshot.value)) return

  const synced = ProjectWorkPath.syncWorkPathsForNatures(
    {
      ...form,
      natures: nextNatures,
      isJiagongdan: editingRecord.value?.isJiagongdan ?? false,
      receivedDate: editingRecord.value?.receivedDate ?? form.plannedStartDate ?? '',
    },
    naturesSnapshot.value,
    localWorkPathConfig.value.pathPatterns,
  )
  form.designWorkPath = synced.designWorkPath
  form.detailWorkPath = synced.detailWorkPath
  form.localWorkPath = synced.localWorkPath
  naturesSnapshot.value = nextNatures
}

const formRules = ProjectForm.FORM_RULES
const dialogTitle = computed(() => {
  if (dialogMode.value === 'edit') return '编辑项目'
  if (dialogMode.value === 'copy') return '复制为新项目'
  return '新建项目'
})
const localWorkPathConfig = ref<LocalWorkPathConfig>({
  ...BusinessSystemConfig.LOCAL_WORK_PATH,
})
const designWorkPathPreview = computed(() =>
  ProjectForm.buildLocalWorkPathFull(form.designWorkPath, localWorkPathConfig.value),
)
const detailWorkPathPreview = computed(() =>
  ProjectForm.buildLocalWorkPathFull(form.detailWorkPath, localWorkPathConfig.value),
)

const searchForm = reactive({
  keyword: '',
  status: '',
  tags: [] as string[],
  assignedPersonnelId: '',
  flowFilter: [] as string[],
  natureFilter: [] as string[],
})

const statusOptions = ProjectForm.STATUS_OPTIONS
const statusFormOptions = ProjectForm.STATUS_FORM_OPTIONS
const natureOptions = ProjectForm.NATURE_OPTIONS
const structureTypeOptions = ProjectForm.STRUCTURE_TYPE_OPTIONS

const personnelOptions = ref<PersonnelRecord[]>([])
let personnelFilterReady = false
let suppressPersonnelFilterWatch = false

// ── 分页列表（按筛选条件分桶缓存，切换筛选时保留已查数据）──
const {
  pageSize,
  filteredData,
  total,
  page,
  loading,
  loadPage: loadCachedPage,
  loadMergedFilteredPage,
  loadAroundAnchor: loadCachedAroundAnchor,
  clearFilterCache,
  patchItem,
  getGlobalCachedItems,
  getFilters,
} = usePaginatedListCache<ProjectRecord>({
  getItemKey: (item) => item.projectNo,
  sortList: ProjectForm.sortForDisplay,
})

type PaginatedFilters = {
  keyword?: string
  status?: string
  tags?: string[]
  assignedPersonnelId?: string
  flowFilters?: string[]
  natures?: string[]
}

function hasColumnFilters() {
  return (
    searchForm.flowFilter.length > 0 ||
    searchForm.natureFilter.length > 0 ||
    Boolean(searchForm.assignedPersonnelId)
  )
}

function getCachedMatchingColumnFiltered() {
  return getGlobalCachedItems().filter((record) => {
    if (
      searchForm.assignedPersonnelId &&
      !ProjectForm.matchesAssignedPersonnelFilter(record, searchForm.assignedPersonnelId)
    ) {
      return false
    }
    if (
      searchForm.flowFilter.length &&
      !ProjectForm.matchesFlowFilters(record, searchForm.flowFilter)
    ) {
      return false
    }
    if (
      searchForm.natureFilter.length &&
      !ProjectForm.matchesNatureFilters(record, searchForm.natureFilter)
    ) {
      return false
    }
    return true
  })
}

function buildListQuery(params: PaginatedFilters & { page?: number; pageSize?: number; anchor?: string; all?: boolean; excludeProjectNos?: string[] }) {
  return {
    keyword: params.keyword,
    status: params.status,
    tags: params.tags,
    assignedPersonnelId: params.assignedPersonnelId,
    flowFilters: params.flowFilters,
    natures: params.natures,
    excludeProjectNos: params.excludeProjectNos,
    page: params.page,
    pageSize: params.pageSize,
    anchor: params.anchor,
    all: params.all,
  }
}

async function loadPage(pageNo = 1, nextFilters?: PaginatedFilters, force = false) {
  return loadCachedPage(
    (params) => fetchProjectList(buildListQuery(params)),
    pageNo,
    nextFilters,
    force,
  )
}

async function loadAroundAnchor(anchor: string, nextFilters?: PaginatedFilters, force = false) {
  return loadCachedAroundAnchor(
    (params) => fetchProjectList(buildListQuery(params)),
    anchor,
    nextFilters,
    force,
  )
}

function buildViewFilters(): PaginatedFilters {
  return {
    keyword: searchForm.keyword,
    status: searchForm.status,
    tags: searchForm.tags.length ? [...searchForm.tags] : undefined,
    assignedPersonnelId: searchForm.assignedPersonnelId || undefined,
    ...(searchForm.flowFilter.length ? { flowFilters: [...searchForm.flowFilter] } : {}),
    ...(searchForm.natureFilter.length ? { natures: [...searchForm.natureFilter] } : {}),
  }
}

async function loadColumnFilteredPage(pageNo = 1, nextFilters?: PaginatedFilters, force = false) {
  const filters = nextFilters ?? buildViewFilters()
  return loadMergedFilteredPage(
    (params) => fetchProjectList(buildListQuery(params)),
    pageNo,
    filters,
    getCachedMatchingColumnFiltered(),
    force,
  )
}

async function loadViewPage(pageNo = 1, nextFilters?: PaginatedFilters, force = false) {
  const filters = nextFilters ?? buildViewFilters()
  if (hasColumnFilters()) {
    return loadColumnFilteredPage(pageNo, filters, force)
  }
  return loadPage(pageNo, filters, force)
}

async function reloadCurrentView(pageNo = page.value || 1, force = false) {
  await loadViewPage(pageNo, buildViewFilters(), force)
}

const editingAssignedPersonnel = ref<ProjectAssignee[]>([])

async function loadProjects(force = false) {
  try {
    await reloadCurrentView(page.value || 1, force)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载项目数据失败')
  }
}

async function handlePageChange(nextPage: number) {
  try {
    await loadViewPage(nextPage)
    highlightedProjectNo.value = ''
    nextTick(() => projectTableRef.value?.tableRef?.setScrollTop(0))
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载项目数据失败')
  }
}

async function handleSizeChange() {
  try {
    await loadViewPage(1)
    highlightedProjectNo.value = ''
    nextTick(() => projectTableRef.value?.tableRef?.setScrollTop(0))
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载项目数据失败')
  }
}

async function handleColumnFilterChange() {
  try {
    await loadViewPage(1, buildViewFilters(), true)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载项目数据失败')
  }
}

function stillMatchesColumnFilters(record: ProjectRecord) {
  if (
    searchForm.assignedPersonnelId &&
    !ProjectForm.matchesAssignedPersonnelFilter(record, searchForm.assignedPersonnelId)
  ) {
    return false
  }
  if (
    searchForm.flowFilter.length &&
    !ProjectForm.matchesFlowFilters(record, searchForm.flowFilter)
  ) {
    return false
  }
  if (
    searchForm.natureFilter.length &&
    !ProjectForm.matchesNatureFilters(record, searchForm.natureFilter)
  ) {
    return false
  }
  return true
}

async function handleSearch() {
  if (route.query.projectNo || route.query.projectNos) {
    router.replace({ path: BIZ_ROUTES.project })
  }
  try {
    await loadViewPage(1, buildViewFilters(), true)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载项目数据失败')
  }
}

async function handleReset() {
  suppressPersonnelFilterWatch = true
  searchForm.keyword = ''
  searchForm.status = ''
  searchForm.tags = []
  searchForm.assignedPersonnelId = ''
  searchForm.flowFilter = []
  searchForm.natureFilter = []
  highlightedProjectNo.value = ''
  if (route.query.projectNo || route.query.projectNos) {
    router.replace({ path: BIZ_ROUTES.project })
  }
  try {
    await loadProjects()
  } finally {
    suppressPersonnelFilterWatch = false
  }
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
}

function handleNatureUpdated(updated: ProjectRecord) {
  patchItem(updated.projectNo, (item) => ({
    ...item,
    ...updated,
  }))
  if (hasColumnFilters() && !stillMatchesColumnFilters(updated)) {
    void reloadCurrentView(page.value, true)
  }
}

function handleDateUpdated(updated: ProjectRecord) {
  patchItem(updated.projectNo, (item) => ({
    ...item,
    ...updated,
  }))
}

function handlePersonnelUpdated(updated: ProjectRecord) {
  patchItem(updated.projectNo, (item) => ({
    ...item,
    ...updated,
  }))
  if (hasColumnFilters() && !stillMatchesColumnFilters(updated)) {
    void reloadCurrentView(page.value, true)
  }
}

function handleStatusUpdated(updated: ProjectRecord) {
  patchItem(updated.projectNo, (item) => ({
    ...item,
    ...updated,
  }))
  if (hasColumnFilters() && !stillMatchesColumnFilters(updated)) {
    void reloadCurrentView(page.value, true)
  }
}

async function handleDelete(row: ProjectRecord) {
  const displayNo = ProjectForm.getDisplayProjectNo(row)
  const label = row.name ? `「${row.name}」（${displayNo}）` : `「${displayNo}」`

  try {
    await ElMessageBox.confirm(`确定删除项目 ${label} 吗？此操作不可恢复。`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }

  try {
    await deleteProject(row.projectNo)
    const activeFilters = getFilters()
    clearFilterCache(activeFilters)
    if (highlightedProjectNo.value === row.projectNo) {
      highlightedProjectNo.value = ''
    }
    const nextPage = filteredData.value.length <= 1 && page.value > 1 ? page.value - 1 : page.value
    await loadViewPage(nextPage, activeFilters, true)
    ElMessage.success('项目已删除')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '删除项目失败')
  }
}

async function loadPersonnelOptions() {
  try {
    personnelOptions.value = await fetchPersonnelList({ status: 'active' })
  } catch {
    personnelOptions.value = []
  }
}

async function bootstrapProjects() {
  const projectNo = route.query.projectNo
  const projectNosParam = route.query.projectNos
  if (projectNo || projectNosParam) {
    await applyProjectNoFromRoute()
    return
  }
  await loadProjects()
}

async function loadSystemConfig() {
  try {
    const response = await fetchSystemConfig()
    localWorkPathConfig.value = { ...response.localWorkPath }
  } catch {
    // 保留默认配置，避免接口不可用时无法编辑项目
  }
}

onMounted(async () => {
  await Promise.all([
    loadPersonnelOptions(),
    loadSystemConfig(),
    bootstrapProjects(),
  ])
  personnelFilterReady = true
})

function openCreateDialog() {
  dialogMode.value = 'create'
  copySourceNo.value = null
  editingProjectNo.value = null
  editingRecord.value = null
  editingAssignedPersonnel.value = []
  Object.assign(form, ProjectForm.createEmptyForm())
  syncNaturesSnapshot()
  dialogVisible.value = true
}

function openEditDialog(row: ProjectRecord) {
  dialogMode.value = 'edit'
  copySourceNo.value = null
  editingProjectNo.value = row.projectNo
  editingRecord.value = ProjectForm.cloneRecord(row)
  editingAssignedPersonnel.value = row.assignedPersonnel.map((person) => ({ ...person }))
  Object.assign(form, ProjectForm.createFormFromRecord(row))
  syncNaturesSnapshot()
  dialogVisible.value = true
}

async function openCopyDialog(row: ProjectRecord) {
  dialogMode.value = 'copy'
  copySourceNo.value = row.projectNo
  editingProjectNo.value = null
  editingRecord.value = ProjectForm.cloneRecord(row)
  editingAssignedPersonnel.value = row.assignedPersonnel.map((person) => ({ ...person }))
  try {
    const result = await fetchProjectList({ all: true })
    Object.assign(
      form,
      ProjectForm.createFormForCopy(
        row,
        result.list.map((item) => item.projectNo),
      ),
    )
    syncNaturesSnapshot()
    dialogVisible.value = true
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载项目列表失败')
  }
}

async function handleCopyAsNew() {
  if (!editingRecord.value) return
  await openCopyDialog(editingRecord.value)
}

async function refreshAfterProjectMutation() {
  const activeFilters = getFilters()
  clearFilterCache(activeFilters)
  await loadViewPage(1, activeFilters, true)
}

async function handleSplit() {
  if (!editingProjectNo.value) return

  try {
    await ElMessageBox.confirm(
      '将把当前项目拆分为两个独立项目：原项目保留联系单，新项目不复制联系单。若项目号尚无 -1 后缀，将自动改名为「根号-1」并创建「根号-2」。是否继续？',
      '拆分项目',
      { type: 'warning', confirmButtonText: '拆分', cancelButtonText: '取消' },
    )
  } catch {
    return
  }

  splitting.value = true
  try {
    const { original, clone } = await splitProject(editingProjectNo.value)
    dialogVisible.value = false
    await refreshAfterProjectMutation()
    ElMessage.success(`已拆分：${original.projectNo}、${clone.projectNo}`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '拆分项目失败')
  } finally {
    splitting.value = false
  }
}

function handleDialogClose() {
  dialogMode.value = 'create'
  copySourceNo.value = null
  editingProjectNo.value = null
  editingRecord.value = null
  editingAssignedPersonnel.value = []
  Object.assign(form, ProjectForm.createEmptyForm())
  naturesSnapshot.value = []
  formRef.value?.clearValidate()
}

function handleWorkflowUpdated(record: ProjectRecord) {
  editingRecord.value = ProjectForm.cloneRecord(record)
  form.detailCompleted = record.detailCompleted
  form.status = record.status
  replaceProjectInTable(record)
}

function replaceProjectInTable(updated: ProjectRecord, originalProjectNo?: string) {
  patchItem(originalProjectNo ?? updated.projectNo, () => updated)
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    const primaryWorkPath = form.detailWorkPath || form.designWorkPath
    if (dialogMode.value === 'copy' && copySourceNo.value) {
      const created = await copyProject(copySourceNo.value, {
        projectNo: form.projectNo.trim(),
        name: form.name.trim(),
        status: form.status,
        designCompleted: form.designCompleted,
        detailCompleted: form.detailCompleted,
        natures: [...form.natures],
        tagIds: [...form.tagIds],
        assignedPersonnelIds: [...form.assignedPersonnelIds],
        plannedStartDate: form.plannedStartDate,
        plannedEndDate: form.plannedEndDate,
        actualStartDate: form.actualStartDate,
        actualEndDate: form.actualEndDate,
        designWorkPath: form.designWorkPath,
        detailWorkPath: form.detailWorkPath,
        localWorkPath: primaryWorkPath,
        drawingIssueEnabled: form.drawingIssueEnabled,
        drawingIssueYearMonth: form.drawingIssueYearMonth,
        structureType: form.structureType || '',
        estimatedWeightTons: form.estimatedWeightTons,
        clearActualDates: true,
      })
      await refreshAfterProjectMutation()
      dialogVisible.value = false
      ElMessage.success(`已复制为新项目：${created.projectNo}`)
      return
    }

    if (editingProjectNo.value) {
      const originalProjectNo = editingProjectNo.value
      const updated = await updateProject(originalProjectNo, {
        projectNo: form.projectNo.trim(),
        name: form.name.trim(),
        status: form.status,
        designCompleted: form.designCompleted,
        detailCompleted: form.detailCompleted,
        natures: [...form.natures],
        tagIds: [...form.tagIds],
        assignedPersonnelIds: [...form.assignedPersonnelIds],
        contactFormIds: [...form.contactFormIds],
        plannedStartDate: form.plannedStartDate,
        plannedEndDate: form.plannedEndDate,
        actualStartDate: form.actualStartDate,
        actualEndDate: form.actualEndDate,
        designWorkPath: form.designWorkPath,
        detailWorkPath: form.detailWorkPath,
        localWorkPath: primaryWorkPath,
        drawingIssueEnabled: form.drawingIssueEnabled,
        drawingIssueYearMonth: form.drawingIssueYearMonth,
        structureType: form.structureType || '',
        estimatedWeightTons: form.estimatedWeightTons,
      })
      replaceProjectInTable(updated, originalProjectNo)
      dialogVisible.value = false
      ElMessage.success('项目已更新')
      return
    }

    await createProject({
      projectNo: form.projectNo.trim(),
      name: form.name.trim(),
      status: form.status,
      designCompleted: form.designCompleted,
      detailCompleted: form.detailCompleted,
      natures: [...form.natures],
      tagIds: [...form.tagIds],
      assignedPersonnelIds: [...form.assignedPersonnelIds],
      plannedStartDate: form.plannedStartDate,
      plannedEndDate: form.plannedEndDate,
      actualStartDate: form.actualStartDate,
      actualEndDate: form.actualEndDate,
      designWorkPath: form.designWorkPath,
      detailWorkPath: form.detailWorkPath,
      localWorkPath: primaryWorkPath,
      drawingIssueEnabled: form.drawingIssueEnabled,
      drawingIssueYearMonth: form.drawingIssueYearMonth,
      structureType: form.structureType || '',
      estimatedWeightTons: form.estimatedWeightTons,
    })
    await refreshAfterProjectMutation()
    dialogVisible.value = false
    ElMessage.success('项目已创建')
  } catch (error) {
    ElMessage.error(
      error instanceof Error
        ? error.message
        : dialogMode.value === 'copy'
          ? '复制项目失败'
          : editingProjectNo.value
            ? '更新项目失败'
            : '创建项目失败',
    )
  } finally {
    submitting.value = false
  }
}

function scrollToProject(projectNo: string) {
  const displayNo = ProjectForm.parseBaseProjectNo(projectNo)
  if (!filteredData.value.some((item) => ProjectForm.getDisplayProjectNo(item) === displayNo)) return

  nextTick(() => {
    const row = document.querySelector('.biz-data-table .el-table__row.is-highlighted')
    row?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  })
}

function normalizeHighlightProjectNo(projectNo: string) {
  return ProjectForm.parseBaseProjectNo(projectNo)
}

async function applyProjectNoFromRoute() {
  const projectNo = route.query.projectNo
  const projectNosParam = route.query.projectNos

  if (typeof projectNosParam === 'string' && projectNosParam) {
    const anchor =
      (typeof projectNo === 'string' && projectNo) ||
      projectNosParam.split(',')[0]?.trim() ||
      ''

    if (!anchor) return

    searchForm.keyword = ''
    searchForm.status = ''
    searchForm.flowFilter = []
    searchForm.natureFilter = []
    highlightedProjectNo.value = normalizeHighlightProjectNo(
      typeof projectNo === 'string' && projectNo ? projectNo : anchor,
    )

    try {
      await loadAroundAnchor(anchor, {})
      nextTick(() => scrollToProject(highlightedProjectNo.value))
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '加载项目数据失败')
    }
    return
  }

  if (typeof projectNo === 'string' && projectNo) {
    searchForm.keyword = ''
    searchForm.status = ''
    searchForm.flowFilter = []
    searchForm.natureFilter = []
    highlightedProjectNo.value = normalizeHighlightProjectNo(projectNo)

    try {
      await loadAroundAnchor(projectNo, {})
      nextTick(() => scrollToProject(projectNo))
    } catch (error) {
      ElMessage.error(error instanceof Error ? error.message : '加载项目数据失败')
    }
    return
  }

  highlightedProjectNo.value = ''
}

watch(
  () => [route.query.projectNo, route.query.projectNos],
  () => {
    void applyProjectNoFromRoute()
  },
)

watch(
  () => [...form.natures],
  (natures) => {
    if (!natures.includes(ProjectForm.NATURE.DESIGN)) {
      form.designCompleted = false
    }
    if (!ProjectForm.hasDetailGroupNature({ natures })) {
      form.detailCompleted = false
    }
    syncWorkPathsForNatureChange()
  },
)

watch(
  () => form.drawingIssueEnabled,
  (enabled) => {
    if (!enabled) {
      form.drawingIssueYearMonth = ''
    }
  },
)

watch(
  () => searchForm.assignedPersonnelId,
  () => {
    if (!personnelFilterReady || suppressPersonnelFilterWatch) return
    void handleColumnFilterChange()
  },
)
</script>

<template>
  <el-card shadow="never" class="biz-page-card">
    <template #header>
      <div class="card-header">
        <div class="card-header__title">
          <span class="card-title">项目管理</span>
        </div>
        <el-button type="primary" @click="openCreateDialog">新建项目</el-button>
      </div>
    </template>

    <div class="search-toolbar">
      <el-form :inline="true" :model="searchForm" class="search-form">
        <el-form-item label="关键词">
          <el-input
            v-model="searchForm.keyword"
            placeholder="项目号 / 名称 / 联系单编号 / 分配人员"
            clearable
            @keyup.enter="handleSearch"
          />
        </el-form-item>
        <el-form-item label="流程状态">
          <el-select v-model="searchForm.status" placeholder="全部" style="width: 120px">
            <el-option
              v-for="item in statusOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="标签">
          <TagSelect v-model="searchForm.tags" :allow-create="false" width="200px" placeholder="全部" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleSearch">查询</el-button>
          <el-button @click="handleReset">重置</el-button>
        </el-form-item>
      </el-form>
      <span class="search-total">共 {{ total }} 条</span>
    </div>

    <div class="project-view-body project-list-panel">
      <div class="table-scroll">
        <ProjectTable
          ref="projectTableRef"
          v-model:assigned-personnel-id="searchForm.assignedPersonnelId"
          v-model:flow-status-filter="searchForm.flowFilter"
          v-model:nature-filter="searchForm.natureFilter"
          :data="filteredData"
          :loading="loading"
          :show-nature="true"
          :show-personnel="true"
          :personnel-options="personnelOptions"
          :highlighted-project-no="highlightedProjectNo"
          @column-filter-change="handleColumnFilterChange"
          @edit="openEditDialog"
          @delete="handleDelete"
          @nature-updated="handleNatureUpdated"
          @personnel-updated="handlePersonnelUpdated"
          @status-updated="handleStatusUpdated"
          @date-updated="handleDateUpdated"
          @path-updated="handlePathUpdated"
        />
      </div>
      <div class="table-pagination">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="pageSize"
          :page-sizes="[...PAGE_SIZE_OPTIONS]"
          :total="total"
          layout="total, sizes, prev, pager, next, jumper"
          background
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </div>
  </el-card>

  <el-dialog
    v-model="dialogVisible"
    :title="dialogTitle"
    width="760px"
    destroy-on-close
    @closed="handleDialogClose"
  >
    <el-form ref="formRef" :model="form" :rules="formRules" label-width="100px">
      <el-form-item label="项目号" prop="projectNo">
        <el-input v-model="form.projectNo" placeholder="请输入项目号" />
      </el-form-item>
      <el-form-item label="项目名称" prop="name">
        <el-input v-model="form.name" placeholder="请输入项目名称" />
      </el-form-item>
      <el-form-item v-if="dialogMode === 'edit'" label="关联联系单">
        <ProjectContactFormSelect
          v-model="form.contactFormIds"
          :display-project-no="ProjectForm.getDisplayProjectNo(editingRecord || { projectNo: form.projectNo, baseProjectNo: form.projectNo })"
        />
      </el-form-item>
      <el-form-item label="本地路径">
        <div class="local-path-group">
          <template v-if="form.natures.includes(ProjectForm.NATURE.DESIGN)">
            <div class="local-path-item">
              <div class="local-path-item__label">设计归档路径</div>
              <el-input
                v-model="form.designWorkPath"
                type="textarea"
                :rows="2"
                placeholder="设计归档相对路径"
                class="local-path-input"
              />
              <div class="form-hint">
                全局配置：{{ localWorkPathConfig.ip }}
                <template v-if="designWorkPathPreview">
                  · 完整路径 {{ designWorkPathPreview }}
                </template>
              </div>
            </div>
          </template>
          <template v-if="ProjectForm.hasDetailGroupNature(form)">
            <div class="local-path-item">
              <div class="local-path-item__label">细化归档路径</div>
              <el-input
                v-model="form.detailWorkPath"
                type="textarea"
                :rows="2"
                placeholder="细化归档相对路径"
                class="local-path-input"
              />
              <div class="form-hint">
                全局配置：{{ localWorkPathConfig.ip }}
                <template v-if="detailWorkPathPreview">
                  · 完整路径 {{ detailWorkPathPreview }}
                </template>
              </div>
            </div>
          </template>
          <div v-if="!form.natures.length" class="form-hint">
            请先选择项目性质，再填写对应的设计归档路径或细化归档路径。
          </div>
        </div>
      </el-form-item>
      <el-form-item label="项目性质">
        <el-checkbox-group v-model="form.natures">
          <el-checkbox
            v-for="item in natureOptions"
            :key="item.value"
            :value="item.value"
          >
            {{ item.label }}
          </el-checkbox>
        </el-checkbox-group>
      </el-form-item>
      <el-form-item label="标签">
        <TagSelect v-model="form.tagIds" />
      </el-form-item>
      <el-form-item label="分配人员">
        <PersonnelAssignSelect
          v-model="form.assignedPersonnelIds"
          :personnel-options="personnelOptions"
          :extra-assignees="editingAssignedPersonnel"
          :collapse-tags="!editingProjectNo"
          :collapse-tags-tooltip="!editingProjectNo"
          placeholder="从人员系统选择分配人员"
          class="personnel-select"
        />
      </el-form-item>
      <el-form-item label="流程状态">
        <el-radio-group v-model="form.status">
          <el-radio
            v-for="item in statusFormOptions"
            :key="item.value"
            :value="item.value"
          >
            {{ item.label }}
          </el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="完成状态">
        <div class="completion-status-grid">
          <el-checkbox v-model="form.designCompleted" :disabled="!form.natures.includes(ProjectForm.NATURE.DESIGN)">
            设计已完成
          </el-checkbox>
          <el-checkbox
            v-if="!DetailWorkflowForm.needsDetailWorkflow(form.natures)"
            v-model="form.detailCompleted"
            :disabled="!ProjectForm.hasDetailGroupNature(form)"
          >
            细化已完成
          </el-checkbox>
        </div>
      </el-form-item>
      <el-form-item
        v-if="dialogMode === 'edit' && editingRecord && DetailWorkflowForm.needsDetailWorkflow(editingRecord.natures)"
        label="细化流程"
      >
        <ProjectDetailWorkflowPanel
          :record="editingRecord"
          @updated="handleWorkflowUpdated"
        />
      </el-form-item>
      <el-form-item label="发图计划">
        <div class="drawing-issue-fields">
          <el-checkbox v-model="form.drawingIssueEnabled">
            是否发图
          </el-checkbox>
          <el-date-picker
            v-model="form.drawingIssueYearMonth"
            type="month"
            placeholder="选择发图年月"
            value-format="YYYY-MM"
            format="YYYY年M月"
            :disabled="!form.drawingIssueEnabled"
            style="width: 180px"
          />
        </div>
      </el-form-item>
      <el-form-item label="结构形式">
        <el-select
          v-model="form.structureType"
          clearable
          placeholder="选择结构形式"
          style="width: 100%"
        >
          <el-option
            v-for="item in structureTypeOptions"
            :key="item.value"
            :label="item.label"
            :value="item.value"
          />
        </el-select>
      </el-form-item>
      <el-form-item label="预估重量">
        <el-input-number
          v-model="form.estimatedWeightTons"
          :min="0"
          :precision="3"
          :controls="false"
          placeholder="吨"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="计划开始">
        <el-date-picker
          v-model="form.plannedStartDate"
          type="date"
          placeholder="选择计划开始日期"
          value-format="YYYY-MM-DD"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="计划结束">
        <el-date-picker
          v-model="form.plannedEndDate"
          type="date"
          placeholder="选择计划结束日期"
          value-format="YYYY-MM-DD"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="实际开始">
        <el-date-picker
          v-model="form.actualStartDate"
          type="date"
          placeholder="选择实际开始日期"
          value-format="YYYY-MM-DD"
          style="width: 100%"
        />
      </el-form-item>
      <el-form-item label="实际结束">
        <el-date-picker
          v-model="form.actualEndDate"
          type="date"
          placeholder="选择实际结束日期"
          value-format="YYYY-MM-DD"
          style="width: 100%"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <div class="project-dialog-footer">
        <div v-if="dialogMode === 'edit'" class="project-dialog-footer__left">
          <el-button @click="handleCopyAsNew">复制为新项目</el-button>
          <el-button :loading="splitting" @click="handleSplit">拆分项目</el-button>
        </div>
        <div class="project-dialog-footer__right">
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" :loading="submitting" @click="handleSubmit">
            {{ dialogMode === 'edit' ? '保存' : dialogMode === 'copy' ? '复制' : '提交' }}
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.local-path-input :deep(.el-textarea__inner) {
  font-family: var(--el-font-family);
  line-height: 1.5;
  word-break: break-all;
}

.local-path-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.local-path-item {
  width: 100%;
}

.local-path-item__label {
  margin-bottom: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-regular);
}

.form-hint {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
  word-break: break-all;
}

/* 列表内容区高度，避免 card 撑高导致页面级滚动 */
.project-view-body {
  --project-pagination-height: 48px;
  --project-table-height: calc(100vh - 300px);
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.project-list-panel .table-scroll {
  height: var(--project-table-height);
  overflow: hidden;
}

.personnel-select {
  width: 100%;
}

.personnel-select :deep(.el-select__tags) {
  flex-wrap: wrap;
  max-width: 100%;
}

.completion-status-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 20px;
}

.drawing-issue-fields {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.project-dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
}

.project-dialog-footer__left,
.project-dialog-footer__right {
  display: flex;
  align-items: center;
  gap: 8px;
}

</style>
