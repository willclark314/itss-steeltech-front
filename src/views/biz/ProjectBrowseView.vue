<script setup lang="ts">
import '@/styles/biz-page-card.css'
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { fetchProjectList } from '@/api/projects'
import ProjectBrowseTable from '@/components/biz/ProjectBrowseTable.vue'
import TagSelect from '@/components/biz/TagSelect.vue'
import { ProjectForm } from '@/models/biz/project'
import type { ProjectGroupBy, ProjectRecord } from '@/models/biz/project'
import { BIZ_ROUTES } from '@/models/biz/navigation'
import { usePaginatedListCache } from '@/composables/usePaginatedListCache'

const route = useRoute()
const router = useRouter()
const projectTableRef = ref<InstanceType<typeof ProjectBrowseTable>>()
const highlightedProjectNo = ref('')

const searchForm = reactive({
  keyword: '',
  status: '',
  tags: [] as string[],
})

const statusOptions = ProjectForm.STATUS_OPTIONS
const groupByOptions = ProjectForm.GROUP_BY_OPTIONS

const pageSize = 20
const {
  filteredData,
  total,
  page,
  loading,
  loadPage: loadCachedPage,
  loadAll: loadCachedAll,
  loadAroundAnchor: loadCachedAroundAnchor,
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

const groupBy = ref<ProjectGroupBy>('')
const isGrouped = computed(() => Boolean(groupBy.value))
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
    router.replace({ path: BIZ_ROUTES.projectBrowse })
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
    router.replace({ path: BIZ_ROUTES.projectBrowse })
  }
  await loadProjects()
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

async function bootstrapProjects() {
  const projectNo = route.query.projectNo
  const projectNosParam = route.query.projectNos
  if (projectNo || projectNosParam) {
    await applyProjectNoFromRoute()
    return
  }
  await loadProjects()
}

onMounted(async () => {
  await bootstrapProjects()
})

watch(
  () => [route.query.projectNo, route.query.projectNos],
  () => {
    void applyProjectNoFromRoute()
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
          <span class="card-title">项目</span>
          <span class="page-tip">查询项目信息</span>
        </div>
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
        <ProjectBrowseTable
          ref="projectTableRef"
          :data="filteredData"
          :loading="loading"
          :show-nature="true"
          :show-personnel="true"
          :highlighted-project-no="highlightedProjectNo"
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
          <ProjectBrowseTable
            :data="activeGroupPageData"
            table-height="100%"
            :show-nature="groupBy !== 'nature'"
            :show-personnel="groupBy !== 'personnel'"
            :highlighted-project-no="highlightedProjectNo"
          />
        </div>
        <div class="table-pagination">
          <el-pagination
            :current-page="getGroupPage(activeGroup.key)"
            :page-size="pageSize"
            :total="activeGroup.members.length"
            layout="total, prev, pager, next, jumper"
            background
            @current-change="(nextPage) => handleGroupPageChange(activeGroup!.key, nextPage)"
          />
        </div>
      </div>
      <el-empty v-else-if="!loading" class="record-group-empty" description="暂无匹配项目" />
    </div>
  </el-card>
</template>

<style scoped>
.page-tip {
  font-size: 12px;
  font-weight: 400;
  line-height: 1.2;
  color: var(--el-text-color-secondary);
}

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
</style>
