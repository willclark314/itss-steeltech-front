<script setup lang="ts">
import '@/styles/biz-page-card.css'
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type FormInstance } from 'element-plus'
import { createProject, deleteProject, fetchProjectList, updateProject } from '@/api/projects'
import { fetchPersonnelList } from '@/api/personnel'
import ProjectTable from '@/components/biz/ProjectTable.vue'
import ProjectDetailWorkflowPanel from '@/components/biz/ProjectDetailWorkflowPanel.vue'
import TagSelect from '@/components/biz/TagSelect.vue'
import { DetailWorkflowForm, ProjectForm } from '@/models/biz/project'
import { fetchSystemConfig } from '@/api/system'
import { BusinessSystemConfig } from '@/models/biz'
import type { LocalWorkPathConfig } from '@/models/biz'
import type { PersonnelRecord } from '@/models/personnel'
import type {
  ProjectAssignee,
  ProjectGroupBy,
  ProjectRecord,
} from '@/models/biz/project'
import { BIZ_ROUTES } from '@/models/biz/navigation'
import { usePaginatedListCache } from '@/composables/usePaginatedListCache'

const route = useRoute()
const router = useRouter()
const submitting = ref(false)
const projectTableRef = ref<InstanceType<typeof ProjectTable>>()
const highlightedProjectNo = ref('')
const editingProjectNo = ref<string | null>(null)
const editingRecord = ref<ProjectRecord | null>(null)
const dialogVisible = ref(false)
const formRef = ref<FormInstance>()
const form = reactive(ProjectForm.createEmptyForm())
const formRules = ProjectForm.FORM_RULES
const dialogTitle = computed(() => (editingProjectNo.value ? '编辑项目' : '新建项目'))
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
})

const statusOptions = ProjectForm.STATUS_OPTIONS
const statusFormOptions = ProjectForm.STATUS_FORM_OPTIONS
const natureOptions = ProjectForm.NATURE_OPTIONS
const groupByOptions = ProjectForm.GROUP_BY_OPTIONS

const personnelOptions = ref<PersonnelRecord[]>([])

// ── 分页列表（按筛选条件分桶缓存，切换筛选/分组时保留已查数据）──
const pageSize = 20
const {
  filteredData,
  total,
  page,
  loading,
  loadPage: loadCachedPage,
  loadAll: loadCachedAll,
  loadAroundAnchor: loadCachedAroundAnchor,
  clearFilterCache,
  patchItem,
  getAllList,
  getFilters,
  cacheRevision,
} = usePaginatedListCache<ProjectRecord>({
  pageSize,
  getItemKey: (item) => item.projectNo,
  sortList: ProjectForm.sortForDisplay,
})

type PaginatedFilters = { keyword?: string; status?: string; tags?: string[] }

function buildListQuery(params: PaginatedFilters & { page?: number; pageSize?: number; anchor?: string; all?: boolean }) {
  return {
    keyword: params.keyword,
    status: params.status,
    tags: params.tags,
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
  }
}

async function loadAllForGrouped(nextFilters?: PaginatedFilters, force = false) {
  return loadCachedAll(
    (params) => fetchProjectList(buildListQuery({ ...params, all: true })),
    nextFilters,
    force,
  )
}

async function reloadCurrentView(force = false) {
  const filters = buildViewFilters()
  if (isGrouped.value) {
    await loadAllForGrouped(filters, force)
    return
  }
  await loadPage(page.value || 1, filters, force)
}

const editingAssignedPersonnel = ref<ProjectAssignee[]>([])
const groupBy = ref<ProjectGroupBy>('')

const isGrouped = computed(() => Boolean(groupBy.value))
// 分组视图使用筛选桶内全量缓存（loadAll），各 Tab 内再按 pageSize 客户端分页
const groupDisplayData = computed(() => {
  void cacheRevision.value
  const filters = getFilters()
  return isGrouped.value ? getAllList(filters) : filteredData.value
})
const recordGroups = computed(() => ProjectForm.groupRecords(groupDisplayData.value, groupBy.value))

type GroupedMode = Exclude<ProjectGroupBy, ''>
const activeGroupKey = ref('')
const activeGroupKeyByMode = ref<Partial<Record<GroupedMode, string>>>({})
const groupPageByKey = ref<Record<string, number>>({})
const groupPageByMode = ref<Partial<Record<GroupedMode, Record<string, number>>>>({})

const activeGroup = computed(
  () => recordGroups.value.find((group) => group.key === activeGroupKey.value) ?? null,
)

const activeGroupPageData = computed(() => {
  const group = activeGroup.value
  if (!group) return []
  return paginateGroupMembers(group.members, group.key)
})

function getGroupPage(groupKey: string) {
  return groupPageByKey.value[groupKey] || 1
}

function paginateGroupMembers(members: ProjectRecord[], groupKey: string) {
  const pageNo = getGroupPage(groupKey)
  const start = (pageNo - 1) * pageSize
  const sorted = ProjectForm.sortForDisplay(members)
  return sorted.slice(start, start + pageSize)
}

function handleGroupPageChange(groupKey: string, nextPage: number) {
  groupPageByKey.value = {
    ...groupPageByKey.value,
    [groupKey]: nextPage,
  }
  const mode = groupBy.value
  if (mode) {
    groupPageByMode.value[mode] = { ...groupPageByKey.value }
  }
}

function clampGroupPages() {
  if (!groupBy.value) return

  const nextPages = { ...groupPageByKey.value }
  let changed = false

  for (const group of recordGroups.value) {
    const maxPage = Math.max(1, Math.ceil(group.members.length / pageSize))
    const currentPage = nextPages[group.key] || 1
    if (currentPage > maxPage) {
      nextPages[group.key] = maxPage
      changed = true
    }
  }

  if (changed) {
    groupPageByKey.value = nextPages
    const mode = groupBy.value
    if (mode) {
      groupPageByMode.value[mode] = { ...nextPages }
    }
  }
}

function resolveActiveGroupKey(
  groups: ReturnType<typeof ProjectForm.groupRecords>,
  mode: ProjectGroupBy,
) {
  if (!mode || !groups.length) return ''
  const saved = activeGroupKeyByMode.value[mode]
  if (saved && groups.some((group) => group.key === saved)) return saved
  return groups[0]?.key ?? ''
}

function resetGroupTabState() {
  activeGroupKeyByMode.value = {}
  activeGroupKey.value = ''
  groupPageByMode.value = {}
  groupPageByKey.value = {}
}

function syncActiveGroupKey() {
  if (!groupBy.value) {
    activeGroupKey.value = ''
    return
  }
  activeGroupKey.value = resolveActiveGroupKey(recordGroups.value, groupBy.value)
}

function rememberActiveGroupKey() {
  const mode = groupBy.value
  if (mode && activeGroupKey.value) {
    activeGroupKeyByMode.value[mode] = activeGroupKey.value
  }
}

type PersonnelSelectOption = {
  id: string
  name: string
  team: string
}

const personnelSelectOptions = computed((): PersonnelSelectOption[] => {
  const optionMap = new Map<string, PersonnelSelectOption>()

  for (const person of personnelOptions.value) {
    optionMap.set(person.id, { id: person.id, name: person.name, team: person.team })
  }

  for (const person of editingAssignedPersonnel.value) {
    if (!optionMap.has(person.id)) {
      optionMap.set(person.id, { id: person.id, name: person.name, team: person.team })
    }
  }

  return [...optionMap.values()].sort((a, b) => {
    const teamCompare = a.team.localeCompare(b.team, 'zh-CN')
    return teamCompare !== 0 ? teamCompare : a.name.localeCompare(b.name, 'zh-CN')
  })
})

async function loadProjects(force = false) {
  try {
    await reloadCurrentView(force)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载项目数据失败')
  }
}

async function handlePageChange(nextPage: number) {
  try {
    await loadPage(nextPage, getFilters())
    highlightedProjectNo.value = ''
    nextTick(() => projectTableRef.value?.tableRef?.setScrollTop(0))
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载项目数据失败')
  }
}

async function handleSearch() {
  if (route.query.projectNo || route.query.projectNos) {
    router.replace({ path: BIZ_ROUTES.project })
  }
  resetGroupTabState()
  const filters = buildViewFilters()
  try {
    if (isGrouped.value) {
      await loadAllForGrouped(filters, true)
    } else {
      await loadPage(1, filters, true)
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载项目数据失败')
  }
}

async function handleReset() {
  searchForm.keyword = ''
  searchForm.status = ''
  searchForm.tags = []
  highlightedProjectNo.value = ''
  resetGroupTabState()
  if (route.query.projectNo || route.query.projectNos) {
    router.replace({ path: BIZ_ROUTES.project })
  }
  await loadProjects()
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
}

function handleStatusUpdated(updated: ProjectRecord) {
  patchItem(updated.projectNo, (item) => ({
    ...item,
    ...updated,
  }))
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
    if (isGrouped.value) {
      await loadAllForGrouped(activeFilters, true)
    } else {
      await loadPage(nextPage, activeFilters, true)
    }
    ElMessage.success('项目已删除')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '删除项目失败')
  }
}

async function loadPersonnelOptions() {
  try {
    personnelOptions.value = await fetchPersonnelList()
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
  await Promise.all([loadPersonnelOptions(), loadSystemConfig()])
  await bootstrapProjects()
})

function openCreateDialog() {
  editingProjectNo.value = null
  editingRecord.value = null
  editingAssignedPersonnel.value = []
  Object.assign(form, ProjectForm.createEmptyForm())
  dialogVisible.value = true
}

function openEditDialog(row: ProjectRecord) {
  editingProjectNo.value = row.projectNo
  editingRecord.value = ProjectForm.cloneRecord(row)
  editingAssignedPersonnel.value = row.assignedPersonnel.map((person) => ({ ...person }))
  Object.assign(form, ProjectForm.createFormFromRecord(row))
  dialogVisible.value = true
}

function handleDialogClose() {
  editingProjectNo.value = null
  editingRecord.value = null
  editingAssignedPersonnel.value = []
  Object.assign(form, ProjectForm.createEmptyForm())
  formRef.value?.clearValidate()
}

function handleWorkflowUpdated(record: ProjectRecord) {
  editingRecord.value = ProjectForm.cloneRecord(record)
  form.detailCompleted = record.detailCompleted
  form.status = record.status
  replaceProjectInTable(record)
}

function replaceProjectInTable(updated: ProjectRecord) {
  patchItem(updated.projectNo, () => updated)
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    const primaryWorkPath = form.detailWorkPath || form.designWorkPath
    if (editingProjectNo.value) {
      const updated = await updateProject(editingProjectNo.value, {
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
      })
      replaceProjectInTable(updated)
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
    })
    const activeFilters = getFilters()
    clearFilterCache(activeFilters)
    if (isGrouped.value) {
      await loadAllForGrouped(activeFilters, true)
    } else {
      await loadPage(1, activeFilters, true)
    }
    dialogVisible.value = false
    ElMessage.success('项目已创建')
  } catch (error) {
    ElMessage.error(
      error instanceof Error
        ? error.message
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
  },
)

watch(groupBy, (mode, prevMode) => {
  if (prevMode) {
    const previousKey = activeGroupKey.value
    if (previousKey) {
      activeGroupKeyByMode.value[prevMode] = previousKey
    }
    if (Object.keys(groupPageByKey.value).length) {
      groupPageByMode.value[prevMode] = { ...groupPageByKey.value }
    }
  }

  if (mode) {
    groupPageByKey.value = { ...(groupPageByMode.value[mode] ?? {}) }
    syncActiveGroupKey()
    void loadAllForGrouped(getFilters()).catch((error) => {
      ElMessage.error(error instanceof Error ? error.message : '加载项目数据失败')
    })
    return
  }

  groupPageByKey.value = {}
  void loadPage(page.value || 1, getFilters()).catch((error) => {
    ElMessage.error(error instanceof Error ? error.message : '加载项目数据失败')
  })
})

watch(recordGroups, () => {
  if (!groupBy.value) return
  const nextKey = resolveActiveGroupKey(recordGroups.value, groupBy.value)
  if (nextKey !== activeGroupKey.value) {
    activeGroupKey.value = nextKey
  }
  clampGroupPages()
})

watch(activeGroupKey, rememberActiveGroupKey)
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
        <el-form-item label="分组">
          <el-select v-model="groupBy" style="width: 130px">
            <el-option
              v-for="item in groupByOptions"
              :key="item.value || 'list'"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <span class="search-total">共 {{ total }} 条</span>
    </div>

    <div v-if="!isGrouped" class="project-view-body project-list-panel">
      <div class="table-scroll">
        <ProjectTable
          ref="projectTableRef"
          :data="filteredData"
          :loading="loading"
          :show-nature="true"
          :show-personnel="true"
          :personnel-options="personnelOptions"
          :highlighted-project-no="highlightedProjectNo"
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
          :page-size="pageSize"
          :total="total"
          layout="total, prev, pager, next, jumper"
          background
          @current-change="handlePageChange"
        />
      </div>
    </div>

    <div v-else v-loading="loading" class="project-view-body record-group-panel">
      <el-tabs
        v-if="recordGroups.length"
        v-model="activeGroupKey"
        class="record-group-tabs"
      >
        <el-tab-pane
          v-for="group in recordGroups"
          :key="group.key"
          :name="group.key"
        >
          <template #label>
            <span class="record-group-tab-label">
              {{ group.label }}
              <span class="record-group-tab-count">{{ group.members.length }}</span>
            </span>
          </template>
        </el-tab-pane>
      </el-tabs>
      <div v-if="activeGroup" class="record-group-content">
        <div class="table-scroll">
          <ProjectTable
            :data="activeGroupPageData"
            table-height="100%"
            :show-nature="groupBy !== 'nature'"
            :show-personnel="groupBy !== 'personnel'"
            :personnel-options="personnelOptions"
            :highlighted-project-no="highlightedProjectNo"
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
            :current-page="getGroupPage(activeGroup.key)"
            :page-size="pageSize"
            :total="activeGroup.members.length"
            layout="total, prev, pager, next, jumper"
            background
            @current-change="(nextPage) => handleGroupPageChange(activeGroup.key, nextPage)"
          />
        </div>
      </div>
      <el-empty v-else-if="!loading" class="record-group-empty" description="暂无匹配项目" />
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
        <el-input
          :model-value="editingProjectNo ? ProjectForm.getDisplayProjectNo({ projectNo: form.projectNo, baseProjectNo: '' }) : form.projectNo"
          placeholder="请输入项目号"
          :disabled="!!editingProjectNo"
          @update:model-value="(value: string) => { if (!editingProjectNo) form.projectNo = value }"
        />
      </el-form-item>
      <el-form-item label="项目名称" prop="name">
        <el-input v-model="form.name" placeholder="请输入项目名称" />
      </el-form-item>
      <el-form-item label="本地路径">
        <div class="local-path-group">
          <template v-if="form.natures.includes(ProjectForm.NATURE.DESIGN)">
            <div class="local-path-item">
              <div class="local-path-item__label">设计路径</div>
              <el-input
                v-model="form.designWorkPath"
                type="textarea"
                :rows="2"
                placeholder="设计相对路径"
                class="local-path-input"
              />
              <div class="form-hint">
                全局配置：{{ localWorkPathConfig.ip }} · {{ localWorkPathConfig.drive }} 盘
                <template v-if="designWorkPathPreview">
                  · 完整路径 {{ designWorkPathPreview }}
                </template>
              </div>
            </div>
          </template>
          <template v-if="ProjectForm.hasDetailGroupNature(form)">
            <div class="local-path-item">
              <div class="local-path-item__label">细化路径</div>
              <el-input
                v-model="form.detailWorkPath"
                type="textarea"
                :rows="2"
                placeholder="细化相对路径"
                class="local-path-input"
              />
              <div class="form-hint">
                全局配置：{{ localWorkPathConfig.ip }} · {{ localWorkPathConfig.drive }} 盘
                <template v-if="detailWorkPathPreview">
                  · 完整路径 {{ detailWorkPathPreview }}
                </template>
              </div>
            </div>
          </template>
          <div v-if="!form.natures.length" class="form-hint">
            请先选择项目性质，再填写对应的设计路径或细化路径。
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
        <el-select
          v-model="form.assignedPersonnelIds"
          multiple
          filterable
          :collapse-tags="!editingProjectNo"
          :collapse-tags-tooltip="!editingProjectNo"
          placeholder="从人员系统选择分配人员"
          class="personnel-select"
          style="width: 100%"
        >
          <el-option
            v-for="person in personnelSelectOptions"
            :key="person.id"
            :label="`${person.name} · ${person.team}`"
            :value="person.id"
          />
        </el-select>
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
        v-if="editingRecord && DetailWorkflowForm.needsDetailWorkflow(editingRecord.natures)"
        label="细化流程"
      >
        <ProjectDetailWorkflowPanel
          :record="editingRecord"
          :preview-natures="form.natures"
          @updated="handleWorkflowUpdated"
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
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" :loading="submitting" @click="handleSubmit">
        {{ editingProjectNo ? '保存' : '提交' }}
      </el-button>
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

/* 列表 / 分组共用内容区高度，避免 card 撑高导致页面级滚动 */
.project-view-body {
  --project-pagination-height: 48px;
  --project-table-height: calc(100vh - 300px);
  --project-data-block-height: calc(var(--project-table-height) + var(--project-pagination-height));
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.project-list-panel .table-scroll {
  height: var(--project-table-height);
  overflow: hidden;
}

.record-group-panel {
  height: var(--project-data-block-height);
  gap: 0;
}

.record-group-content {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.record-group-panel .table-scroll {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.record-group-panel .table-pagination {
  flex-shrink: 0;
  margin-top: 12px;
}

.record-group-empty {
  flex: 1;
  min-height: 0;
}

.record-group-tabs {
  flex-shrink: 0;
}

.record-group-tabs :deep(.el-tabs__header) {
  margin-bottom: 6px;
}

.record-group-tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
}

.record-group-tabs :deep(.el-tabs__item) {
  height: 26px;
  padding: 0 8px;
  font-size: 12px;
  line-height: 26px;
}

.record-group-tabs :deep(.el-tabs__active-bar) {
  height: 2px;
}

.record-group-tab-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.record-group-tab-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 16px;
  height: 14px;
  padding: 0 4px;
  font-size: 11px;
  font-weight: 500;
  line-height: 1;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color);
  border-radius: 7px;
}

.record-group-tabs :deep(.el-tabs__item.is-active) .record-group-tab-count {
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
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

</style>
