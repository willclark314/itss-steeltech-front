<script setup lang="ts">
import '@/styles/biz-page-card.css'
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, type FormInstance } from 'element-plus'
import { createProject, fetchProjectList, updateProject } from '@/api/projects'
import { fetchPersonnelList } from '@/api/personnel'
import ProjectTable from '@/components/biz/ProjectTable.vue'
import { ProjectForm } from '@/models/biz/project'
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

const route = useRoute()
const router = useRouter()
const submitting = ref(false)
const projectTableRef = ref<InstanceType<typeof ProjectTable>>()
const highlightedProjectNo = ref('')
const editingProjectNo = ref<string | null>(null)
const dialogVisible = ref(false)
const formRef = ref<FormInstance>()
const form = reactive(ProjectForm.createEmptyForm())
const formRules = ProjectForm.FORM_RULES
const dialogTitle = computed(() => (editingProjectNo.value ? '编辑项目' : '新建项目'))
const localWorkPathConfig = ref<LocalWorkPathConfig>({
  ...BusinessSystemConfig.LOCAL_WORK_PATH,
})
const localWorkPathPreview = computed(() =>
  ProjectForm.buildLocalWorkPathFull(form.localWorkPath, localWorkPathConfig.value),
)

const searchForm = reactive({
  keyword: '',
  status: '',
})

const statusOptions = ProjectForm.STATUS_OPTIONS
const statusFormOptions = ProjectForm.STATUS_FORM_OPTIONS
const natureOptions = ProjectForm.NATURE_OPTIONS
const groupByOptions = ProjectForm.GROUP_BY_OPTIONS

const personnelOptions = ref<PersonnelRecord[]>([])

// ── 分页列表 ──
const pageSize = 20
const filteredData = ref<ProjectRecord[]>([])
const total = ref(0)
const page = ref(1)
const totalPages = ref(1)
const loading = ref(false)

type PaginatedFilters = { keyword?: string; status?: string }

const listCache = new Map<
  string,
  { list: ProjectRecord[]; total: number; page: number; pageSize: number; totalPages: number }
>()
let listFilters: PaginatedFilters = {}

function buildListCacheKey(pageNo: number, nextFilters = listFilters) {
  return JSON.stringify({ ...nextFilters, page: pageNo, pageSize })
}

function applyListResult(result: {
  list: ProjectRecord[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}) {
  filteredData.value = result.list
  total.value = result.total
  page.value = result.page
  totalPages.value = result.totalPages
  listCache.set(buildListCacheKey(result.page), {
    list: [...result.list],
    total: result.total,
    page: result.page,
    pageSize: result.pageSize,
    totalPages: result.totalPages,
  })
}

async function loadPage(pageNo = 1, nextFilters?: PaginatedFilters, force = false) {
  if (nextFilters) {
    const filtersChanged = JSON.stringify(nextFilters) !== JSON.stringify(listFilters)
    if (filtersChanged) {
      clearCache()
      listFilters = { ...nextFilters }
    }
  }

  const cacheKey = buildListCacheKey(pageNo)
  if (!force && listCache.has(cacheKey)) {
    applyListResult(listCache.get(cacheKey)!)
    return
  }

  loading.value = true
  try {
    const result = await fetchProjectList({
      ...listFilters,
      page: pageNo,
      pageSize,
    })
    applyListResult(result)
  } finally {
    loading.value = false
  }
}

async function loadAroundAnchor(anchor: string, nextFilters?: PaginatedFilters) {
  if (nextFilters) {
    listFilters = { ...nextFilters }
  }

  const cacheKey = `${JSON.stringify({ ...listFilters, pageSize })}::anchor::${anchor}`
  if (listCache.has(cacheKey)) {
    applyListResult(listCache.get(cacheKey)!)
    return
  }

  loading.value = true
  try {
    const result = await fetchProjectList({
      ...listFilters,
      anchor,
      pageSize,
    })
    listCache.set(cacheKey, {
      list: [...result.list],
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    })
    listCache.set(buildListCacheKey(result.page), {
      list: [...result.list],
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      totalPages: result.totalPages,
    })
    applyListResult(result)
  } finally {
    loading.value = false
  }
}

function clearCache() {
  listCache.clear()
}

function patchItem(key: string, updater: (item: ProjectRecord) => ProjectRecord) {
  const currentIndex = filteredData.value.findIndex((item) => item.projectNo === key)
  if (currentIndex !== -1) {
    filteredData.value[currentIndex] = updater(filteredData.value[currentIndex]!)
  }

  for (const [cacheKey, cached] of listCache.entries()) {
    const index = cached.list.findIndex((item) => item.projectNo === key)
    if (index === -1) continue

    const nextList = [...cached.list]
    nextList[index] = updater(nextList[index]!)
    listCache.set(cacheKey, {
      ...cached,
      list: nextList,
    })
  }
}

const editingAssignedPersonnel = ref<ProjectAssignee[]>([])
const groupBy = ref<ProjectGroupBy>('')
const groupData = ref<ProjectRecord[]>([])
const groupLoading = ref(false)

const isGrouped = computed(() => Boolean(groupBy.value))
const recordGroups = computed(() =>
  ProjectForm.groupRecords(isGrouped.value ? groupData.value : filteredData.value, groupBy.value),
)

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

async function loadGroupData() {
  if (!groupBy.value) return

  groupLoading.value = true
  try {
    const result = await fetchProjectList({
      keyword: searchForm.keyword,
      status: searchForm.status,
      all: true,
    })
    groupData.value = result.list
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载项目数据失败')
  } finally {
    groupLoading.value = false
  }
}

async function loadProjects() {
  try {
    if (isGrouped.value) {
      await loadGroupData()
      return
    }
    await loadPage(1, {
      keyword: searchForm.keyword,
      status: searchForm.status,
    })
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载项目数据失败')
  }
}

async function handlePageChange(nextPage: number) {
  try {
    await loadPage(nextPage)
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
  await loadProjects()
}

async function handleReset() {
  searchForm.keyword = ''
  searchForm.status = ''
  highlightedProjectNo.value = ''
  if (route.query.projectNo || route.query.projectNos) {
    router.replace({ path: BIZ_ROUTES.project })
  }
  await loadProjects()
}

function handlePathUpdated(projectNo: string, localWorkPath: string) {
  patchItem(projectNo, (item) => ({ ...item, localWorkPath }))
  if (isGrouped.value) {
    const grouped = groupData.value.find((item) => item.projectNo === projectNo)
    if (grouped) grouped.localWorkPath = localWorkPath
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
  editingAssignedPersonnel.value = []
  Object.assign(form, ProjectForm.createEmptyForm())
  dialogVisible.value = true
}

function openEditDialog(row: ProjectRecord) {
  editingProjectNo.value = row.projectNo
  editingAssignedPersonnel.value = row.assignedPersonnel.map((person) => ({ ...person }))
  Object.assign(form, ProjectForm.createFormFromRecord(row))
  dialogVisible.value = true
}

function handleDialogClose() {
  editingProjectNo.value = null
  editingAssignedPersonnel.value = []
  Object.assign(form, ProjectForm.createEmptyForm())
  formRef.value?.clearValidate()
}

function replaceProjectInTable(updated: ProjectRecord) {
  patchItem(updated.projectNo, () => updated)
  if (isGrouped.value) {
    const index = groupData.value.findIndex((item) => item.projectNo === updated.projectNo)
    if (index !== -1) {
      groupData.value[index] = updated
    }
  }
}

async function handleSubmit() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    if (editingProjectNo.value) {
      const updated = await updateProject(editingProjectNo.value, {
        name: form.name.trim(),
        status: form.status,
        natures: [...form.natures],
        assignedPersonnelIds: [...form.assignedPersonnelIds],
        plannedStartDate: form.plannedStartDate,
        plannedEndDate: form.plannedEndDate,
        actualStartDate: form.actualStartDate,
        actualEndDate: form.actualEndDate,
        localWorkPath: form.localWorkPath,
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
      natures: [...form.natures],
      assignedPersonnelIds: [...form.assignedPersonnelIds],
      plannedStartDate: form.plannedStartDate,
      plannedEndDate: form.plannedEndDate,
      actualStartDate: form.actualStartDate,
      actualEndDate: form.actualEndDate,
      localWorkPath: form.localWorkPath,
    })
    clearCache()
    if (isGrouped.value) {
      await loadGroupData()
    } else {
      await loadPage(
        1,
        {
          keyword: searchForm.keyword,
          status: searchForm.status,
        },
        true,
      )
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
  if (!filteredData.value.some((item) => item.projectNo === projectNo)) return

  nextTick(() => {
    const row = document.querySelector('.biz-data-table .el-table__row.is-highlighted')
    row?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  })
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
    highlightedProjectNo.value = typeof projectNo === 'string' ? projectNo : anchor

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
    highlightedProjectNo.value = projectNo

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

watch(groupBy, () => {
  void loadProjects()
})
</script>

<template>
  <el-card shadow="never" class="biz-page-card">
    <template #header>
      <div class="card-header">
        <div class="card-header__title">
          <span class="card-title">项目</span>
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
        <el-form-item label="状态">
          <el-select v-model="searchForm.status" placeholder="全部" style="width: 120px">
            <el-option
              v-for="item in statusOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
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

    <div v-if="!isGrouped">
      <div class="table-scroll">
        <ProjectTable
          ref="projectTableRef"
          :data="filteredData"
          :loading="loading"
          :show-nature="true"
          :show-personnel="true"
          :highlighted-project-no="highlightedProjectNo"
          @edit="openEditDialog"
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

    <div v-else v-loading="groupLoading" class="record-group-list">
      <div v-for="group in recordGroups" :key="group.key" class="record-section">
        <div class="record-section-header">
          <span class="record-section-title">{{ group.label }}</span>
          <span class="record-section-count">{{ group.members.length }} 项</span>
        </div>
        <div class="table-scroll">
          <ProjectTable
            :data="group.members"
            :show-nature="groupBy !== 'nature'"
            :show-personnel="groupBy !== 'personnel'"
            :highlighted-project-no="highlightedProjectNo"
            @edit="openEditDialog"
            @path-updated="handlePathUpdated"
          />
        </div>
      </div>
      <el-empty v-if="!recordGroups.length" description="暂无匹配项目" />
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
          v-model="form.projectNo"
          placeholder="请输入项目号"
          :disabled="!!editingProjectNo"
        />
      </el-form-item>
      <el-form-item label="项目名称" prop="name">
        <el-input v-model="form.name" placeholder="请输入项目名称" />
      </el-form-item>
      <el-form-item label="本地路径">
        <el-input
          v-model="form.localWorkPath"
          type="textarea"
          :rows="2"
          placeholder="相对路径，如 钢结构项目/AB24259"
          class="local-path-input"
        />
        <div class="form-hint">
          全局配置：{{ localWorkPathConfig.ip }} · {{ localWorkPathConfig.drive }} 盘
          <template v-if="localWorkPathPreview">
            · 完整路径 {{ localWorkPathPreview }}
          </template>
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
      <el-form-item label="状态">
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

.form-hint {
  margin-top: 6px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-text-color-secondary);
  word-break: break-all;
}

.record-group-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
  overflow-x: auto;
}

.record-section-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
  padding: 8px 12px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
}

.record-section-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.record-section-count {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.personnel-select :deep(.el-select__tags) {
  flex-wrap: wrap;
  max-width: 100%;
}

</style>
