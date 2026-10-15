<script setup lang="ts">
import '@/styles/biz-page-card.css'
import { nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { fetchProjectList } from '@/api/projects'
import { fetchPersonnelList } from '@/api/personnel'
import ProductionProjectOverviewTable from '@/components/production/ProductionProjectOverviewTable.vue'
import TagSelect from '@/components/biz/TagSelect.vue'
import { ProjectForm } from '@/models/biz/project'
import type { ProjectRecord } from '@/models/biz/project'
import type { PersonnelRecord } from '@/models/personnel'
import { BIZ_ROUTES } from '@/models/biz/navigation'
import { usePaginatedListCache } from '@/composables/usePaginatedListCache'
import { PAGE_SIZE_OPTIONS } from '@/constants/pagination'

const route = useRoute()
const router = useRouter()
const projectTableRef = ref<InstanceType<typeof ProductionProjectOverviewTable>>()
const highlightedProjectNo = ref('')

const searchForm = reactive({
  keyword: '',
  status: '',
  tags: [] as string[],
  assignedPersonnelId: '',
  flowFilter: [] as string[],
  natureFilter: [] as string[],
})

const personnelOptions = ref<PersonnelRecord[]>([])
let personnelFilterReady = false
let suppressPersonnelFilterWatch = false

const statusOptions = ProjectForm.STATUS_OPTIONS

const {
  pageSize,
  filteredData,
  total,
  page,
  loading,
  loadPage: loadCachedPage,
  loadMergedFilteredPage,
  loadAroundAnchor: loadCachedAroundAnchor,
  getGlobalCachedItems,
  patchItem,
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

function buildListQuery(
  params: PaginatedFilters & {
    page?: number
    pageSize?: number
    anchor?: string
    all?: boolean
    excludeProjectNos?: string[]
  },
) {
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

async function handleSearch() {
  if (route.query.projectNo || route.query.projectNos) {
    router.replace({ path: BIZ_ROUTES.productionProjectOverview })
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
    router.replace({ path: BIZ_ROUTES.productionProjectOverview })
  }
  try {
    await loadProjects()
  } finally {
    suppressPersonnelFilterWatch = false
  }
}

function scrollToProject(projectNo: string) {
  const displayNo = ProjectForm.parseBaseProjectNo(projectNo)
  if (!filteredData.value.some((item) => ProjectForm.getDisplayProjectNo(item) === displayNo)) return

  nextTick(() => {
    const row = document.querySelector('.production-overview-table .el-table__row.is-highlighted')
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

async function bootstrapProjects() {
  const projectNo = route.query.projectNo
  const projectNosParam = route.query.projectNos
  if (projectNo || projectNosParam) {
    await applyProjectNoFromRoute()
    return
  }
  await loadProjects()
}

async function loadPersonnelOptions() {
  try {
    personnelOptions.value = await fetchPersonnelList({ status: 'active' })
  } catch {
    personnelOptions.value = []
  }
}

function handleProjectUpdated(record: ProjectRecord) {
  patchItem(record.projectNo, () => record)
}

onMounted(async () => {
  await Promise.all([loadPersonnelOptions(), bootstrapProjects()])
  personnelFilterReady = true
})

watch(
  () => searchForm.assignedPersonnelId,
  () => {
    if (!personnelFilterReady || suppressPersonnelFilterWatch) return
    void handleColumnFilterChange()
  },
)

watch(
  () => [route.query.projectNo, route.query.projectNos],
  () => {
    void applyProjectNoFromRoute()
  },
)
</script>

<template>
  <el-card shadow="never" class="biz-page-card">
    <template #header>
      <div class="card-header">
        <div class="card-header__title">
          <span class="card-title">项目概况</span>
          <span class="page-tip">维护项目结构形式与预估重量</span>
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
      </el-form>
      <span class="search-total">共 {{ total }} 条</span>
    </div>

    <div class="project-view-body project-list-panel">
      <div class="table-scroll">
        <ProductionProjectOverviewTable
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
          @updated="handleProjectUpdated"
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
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.project-list-panel .table-scroll {
  height: var(--project-table-height);
  overflow: hidden;
}
</style>
