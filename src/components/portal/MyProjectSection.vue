<script setup lang="ts">
import '@/styles/biz-data-table.css'
import { nextTick, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { fetchProjectList, leaveProjectAssignment, saveModelWeight, updateProject } from '@/api/projects'
import ProjectDateEditCell from '@/components/biz/ProjectDateEditCell.vue'
import LocalWorkPathCell from '@/components/biz/LocalWorkPathCell.vue'
import OverflowTooltip from '@/components/biz/OverflowTooltip.vue'
import MyProjectFlowStatusCell from '@/components/portal/MyProjectFlowStatusCell.vue'
import MyProjectFlowStatusHeader from '@/components/portal/MyProjectFlowStatusHeader.vue'
import MyProjectModelWeightCell from '@/components/portal/MyProjectModelWeightCell.vue'
import { usePaginatedListCache } from '@/composables/usePaginatedListCache'
import { ContactForm } from '@/models/biz/contact'
import { ProjectForm } from '@/models/biz/project'
import { MyProjectForm } from '@/models/portal/MyProjectForm'
import type { ProjectContactLink, ProjectNatureCode, ProjectRecord } from '@/models/biz/project'

const props = defineProps<{
  personnelId: string
  personnelTeam?: string
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
const leavingProjectNo = ref('')
const pageSize = 10

type ProjectDateField = 'actualStartDate' | 'actualEndDate' | 'plannedEndDate'

const searchForm = reactive({
  keyword: '',
  flowFilter: [] as string[],
})

const clientFilteredAll = ref<ProjectRecord[]>([])

const {
  filteredData,
  total,
  page,
  loading,
  loadPage,
  loadAll,
  loadAroundAnchor,
  patchItem,
} = usePaginatedListCache<ProjectRecord>({
  pageSize,
  getItemKey: (item) => item.projectNo,
  sortList: ProjectForm.sortForDisplay,
})

function buildFilters() {
  return {
    keyword: searchForm.keyword,
    assignedPersonnelId: props.personnelId,
  }
}

function applyFlowFilteredPage(pageNo: number) {
  const sorted = ProjectForm.sortForDisplay(clientFilteredAll.value)
  const start = (pageNo - 1) * pageSize
  filteredData.value = sorted.slice(start, start + pageSize)
  total.value = sorted.length
  page.value = pageNo
}

async function loadFlowFilteredProjects(pageNo = 1, force = false) {
  try {
    const result = await loadAll(
      (params) =>
        fetchProjectList({
          keyword: params.keyword,
          assignedPersonnelId: params.assignedPersonnelId,
          all: true,
        }),
      buildFilters(),
      force,
    )
    clientFilteredAll.value = result.list.filter((item) =>
      MyProjectForm.matchesFlowFilters(item, props.personnelTeam || '', searchForm.flowFilter),
    )
    applyFlowFilteredPage(pageNo)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载项目失败')
  }
}

async function loadProjects(pageNo = 1, force = false) {
  if (searchForm.flowFilter.length) {
    await loadFlowFilteredProjects(pageNo, force)
    return
  }

  clientFilteredAll.value = []
  try {
    await loadPage(
      (params) =>
        fetchProjectList({
          keyword: params.keyword,
          assignedPersonnelId: params.assignedPersonnelId,
          page: params.page,
          pageSize: params.pageSize,
        }),
      pageNo,
      buildFilters(),
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
  clientFilteredAll.value = []
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

  if (searchForm.flowFilter.length) {
    const index = clientFilteredAll.value.findIndex(
      (item) => ProjectForm.getDisplayProjectNo(item) === displayNo,
    )
    if (index === -1) return
    const pageNo = Math.floor(index / pageSize) + 1
    applyFlowFilteredPage(pageNo)
    scrollToProject(projectNo)
    return
  }

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
            anchor: params.anchor,
            pageSize: params.pageSize,
          }),
        projectNo,
        buildFilters(),
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

  if (searchForm.flowFilter.length) {
    const index = clientFilteredAll.value.findIndex((item) => item.projectNo === row.projectNo)
    if (index !== -1) {
      if (
        MyProjectForm.matchesFlowFilters(updated, props.personnelTeam || '', searchForm.flowFilter)
      ) {
        clientFilteredAll.value[index] = updated
      } else {
        clientFilteredAll.value.splice(index, 1)
      }
      applyFlowFilteredPage(page.value)
    }
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

  if (searchForm.flowFilter.length) {
    const index = clientFilteredAll.value.findIndex((item) => item.projectNo === projectNo)
    if (index !== -1) {
      clientFilteredAll.value[index] = updated as ProjectRecord
    }
  }

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

async function handleModelWeightChange(row: ProjectRecord, value: number | null) {
  const savingKey = row.projectNo
  savingModelWeightKey.value = savingKey
  try {
    const updated = await saveModelWeight(row.projectNo, value)
    patchItem(row.projectNo, () => updated)

    if (searchForm.flowFilter.length) {
      const index = clientFilteredAll.value.findIndex((item) => item.projectNo === row.projectNo)
      if (index !== -1) {
        clientFilteredAll.value[index] = updated
      }
    }

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

function canLeaveProject(row: ProjectRecord) {
  return MyProjectForm.canLeaveProject(row, props.personnelId, props.personnelTeam || '')
}

function removeProjectFromList(projectNo: string) {
  filteredData.value = filteredData.value.filter((item) => item.projectNo !== projectNo)
  total.value = Math.max(0, total.value - 1)

  if (searchForm.flowFilter.length) {
    clientFilteredAll.value = clientFilteredAll.value.filter((item) => item.projectNo !== projectNo)
    applyFlowFilteredPage(page.value)
  }
}

async function handleLeaveProject(row: ProjectRecord) {
  const displayNo = ProjectForm.getDisplayProjectNo(row)
  try {
    await ElMessageBox.confirm(
      `确认退出项目「${displayNo}」？退出后该项目将不再出现在您的列表中。`,
      '退出项目',
      { confirmButtonText: '确认退出', cancelButtonText: '取消', type: 'warning' },
    )
  } catch {
    return
  }

  leavingProjectNo.value = row.projectNo
  try {
    await leaveProjectAssignment(row.projectNo, props.personnelId)
    removeProjectFromList(row.projectNo)
    if (props.highlightedProjectNo === displayNo) {
      emit('clearSelection')
    }
    emit('projectLeft', row.projectNo)
    ElMessage.success('已退出项目')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '退出项目失败')
  } finally {
    if (leavingProjectNo.value === row.projectNo) {
      leavingProjectNo.value = ''
    }
  }
}

function handlePageChange(pageNo: number) {
  emit('clearSelection')
  void loadProjects(pageNo)
}

defineExpose({ focusProject })

watch(
  () => props.personnelId,
  (nextId, prevId) => {
    if (!nextId || nextId === prevId) return
    searchForm.keyword = ''
    searchForm.flowFilter = []
    clientFilteredAll.value = []
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
          <el-input
            v-model="searchForm.keyword"
            placeholder="项目号 / 名称 / 联系单号"
            clearable
            size="small"
            @keyup.enter="handleSearch"
            @clear="handleKeywordClear"
          />
          <el-button type="primary" size="small" @click="handleSearch">查询</el-button>
          <el-button size="small" @click="handleReset">重置</el-button>
        </div>
      </div>
      <span class="my-section__total">共 {{ total }} 条</span>
    </div>

    <div class="my-section__table-wrap">
      <el-table
        ref="tableRef"
        v-loading="loading"
        :data="filteredData"
        stripe
        class="biz-data-table my-project-table"
        :row-class-name="getRowClassName"
        height="100%"
        size="small"
      >
        <el-table-column label="联系单编号" width="115" class-name="tag-column contact-form-column">
          <template #default="{ row }">
            <div v-if="getContactLinks(toProjectRecord(row)).length" class="contact-form-tag-list">
              <OverflowTooltip
                v-for="link in getContactLinks(toProjectRecord(row))"
                :key="`${link.projectNo}:${link.contactFormId}`"
                :content="getContactLinkLabel(link, toProjectRecord(row))"
              >
                <el-tag
                  type="success"
                  size="small"
                  class="cell-tag cell-tag--clickable"
                  @click.stop="handleContactClick(link.contactFormId)"
                >
                  {{ getContactLinkLabel(link, toProjectRecord(row)) }}
                </el-tag>
              </OverflowTooltip>
            </div>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="项目号" width="95" class-name="tag-column project-no-column">
          <template #default="{ row }">
            <OverflowTooltip :content="ProjectForm.getDisplayProjectNo(toProjectRecord(row))">
              <el-tag
                type="primary"
                effect="plain"
                size="small"
                class="cell-tag cell-tag--clickable"
                @click.stop="handleProjectNoClick(toProjectRecord(row))"
              >
                {{ ProjectForm.getDisplayProjectNo(toProjectRecord(row)) }}
              </el-tag>
            </OverflowTooltip>
          </template>
        </el-table-column>
        <el-table-column label="项目名称" min-width="140" class-name="text-column">
          <template #default="{ row }">
            <OverflowTooltip
              v-if="toProjectRecord(row).name"
              :content="toProjectRecord(row).name"
            >
              <span class="ellipsis-cell">{{ toProjectRecord(row).name }}</span>
            </OverflowTooltip>
            <span v-else class="text-muted">-</span>
          </template>
        </el-table-column>
        <el-table-column label="项目性质" width="80" class-name="tag-column nature-column">
          <template #default="{ row }">
            <div
              class="nature-cell"
              :class="{ 'is-empty': !toProjectRecord(row).natures.length }"
            >
              <div v-if="toProjectRecord(row).natures.length" class="nature-tag-list">
                <el-tag
                  v-for="nature in toProjectRecord(row).natures"
                  :key="nature"
                  :type="getNatureMeta(nature)!.type"
                  size="small"
                  class="cell-tag"
                >
                  {{ getNatureMeta(nature)!.label }}
                </el-tag>
              </div>
              <span v-else class="text-muted">-</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column min-width="168" class-name="tag-column">
          <template #header>
            <MyProjectFlowStatusHeader
              v-model="searchForm.flowFilter"
              :personnel-team="personnelTeam || ''"
              @change="handleFlowFilterChange"
            />
          </template>
          <template #default="{ row }">
            <MyProjectFlowStatusCell
              :project="toProjectRecord(row)"
              :personnel-team="personnelTeam || ''"
              :loading-key="savingStatusKey"
              @updated="(updated) => handleStatusUpdated(toProjectRecord(row), updated)"
              @saving="handleStatusSaving"
              @saved="handleStatusSaved"
            />
          </template>
        </el-table-column>
        <el-table-column
          label="模型重量(吨)"
          width="96"
          align="center"
          header-align="center"
          class-name="model-weight-column"
        >
          <template #default="{ row }">
            <MyProjectModelWeightCell
              :project="toProjectRecord(row)"
              :personnel-team="personnelTeam || ''"
              :loading="savingModelWeightKey === toProjectRecord(row).projectNo"
              @change="(value) => handleModelWeightChange(toProjectRecord(row), value)"
            />
          </template>
        </el-table-column>
        <el-table-column label="实际开始" width="108" align="center" class-name="date-column">
          <template #default="{ row }">
            <ProjectDateEditCell
              :model-value="toProjectRecord(row).actualStartDate"
              :loading="isDateSaving(toProjectRecord(row).projectNo, 'actualStartDate')"
              @change="(value) => handleDateChange(toProjectRecord(row), 'actualStartDate', value)"
            />
          </template>
        </el-table-column>
        <el-table-column label="实际完成" width="108" align="center" class-name="date-column">
          <template #default="{ row }">
            <ProjectDateEditCell
              :model-value="toProjectRecord(row).actualEndDate"
              :loading="isDateSaving(toProjectRecord(row).projectNo, 'actualEndDate')"
              @change="(value) => handleDateChange(toProjectRecord(row), 'actualEndDate', value)"
            />
          </template>
        </el-table-column>
        <el-table-column label="计划完成" width="108" align="center" class-name="date-column">
          <template #default="{ row }">
            <ProjectDateEditCell
              :model-value="toProjectRecord(row).plannedEndDate"
              :loading="isDateSaving(toProjectRecord(row).projectNo, 'plannedEndDate')"
              @change="(value) => handleDateChange(toProjectRecord(row), 'plannedEndDate', value)"
            />
          </template>
        </el-table-column>
        <el-table-column
          label="本地路径"
          width="50"
          align="center"
          header-align="center"
          class-name="local-path-column"
        >
          <template #default="{ row }">
            <LocalWorkPathCell
              :project="toProjectRecord(row)"
              @path-updated="handlePathUpdated"
            />
          </template>
        </el-table-column>
        <el-table-column
          label="操作"
          width="52"
          align="center"
          header-align="center"
          fixed="right"
          class-name="action-column"
        >
          <template #default="{ row }">
            <el-button
              v-if="canLeaveProject(toProjectRecord(row))"
              link
              type="danger"
              size="small"
              :loading="leavingProjectNo === toProjectRecord(row).projectNo"
              @click.stop="handleLeaveProject(toProjectRecord(row))"
            >
              退出
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="my-section__pagination">
      <el-pagination
        v-model:current-page="page"
        :page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        background
        small
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
