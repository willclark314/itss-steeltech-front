<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { ArrowDown, Download, EditPen, Upload } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import {
  downloadPersonnelCsvTemplate,
  fetchPersonnelList,
  importPersonnelCsv,
} from '@/api/personnel'
import { PersonnelForm } from '@/models/personnel'
import type { PersonnelGroupBy, PersonnelRecord } from '@/models/personnel'
import PersonnelDetailDrawer from '@/components/personnel/PersonnelDetailDrawer.vue'
import PersonnelFormDialog from '@/components/personnel/PersonnelFormDialog.vue'
import PersonnelTable from '@/components/personnel/PersonnelTable.vue'
import { canEditPage } from '@/utils/permission'

const canEdit = computed(() => canEditPage('person'))
const loading = ref(false)
const exporting = ref(false)
const importing = ref(false)
const detailVisible = ref(false)
const createVisible = ref(false)
const currentRecord = ref<PersonnelRecord | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const activeWorkshop = ref('')

const searchForm = reactive({
  keyword: '',
  status: '',
})

const statusOptions = PersonnelForm.STATUS_OPTIONS
const groupByOptions = PersonnelForm.GROUP_BY_OPTIONS

const tableData = ref<PersonnelRecord[]>([])
const filteredData = ref<PersonnelRecord[]>([])
const groupBy = ref<PersonnelGroupBy>('team')

const workshopTabs = computed(() => PersonnelForm.collectWorkshopTabs(filteredData.value))

const workshopData = computed(() =>
  PersonnelForm.filterByWorkshop(filteredData.value, activeWorkshop.value),
)

const recordGroups = computed(() => PersonnelForm.groupRecords(workshopData.value, groupBy.value))
const isGrouped = computed(() => Boolean(groupBy.value))

function countByStatus(members: PersonnelRecord[], status: PersonnelRecord['status']) {
  return members.filter((item) => item.status === status).length
}

watch(
  workshopTabs,
  (tabs) => {
    if (!tabs.length) {
      activeWorkshop.value = ''
      return
    }
    if (!tabs.some((tab) => tab.key === activeWorkshop.value)) {
      activeWorkshop.value = tabs[0]!.key
    }
  },
  { immediate: true },
)

async function loadPersonnel() {
  loading.value = true
  try {
    tableData.value = await fetchPersonnelList()
    filteredData.value = PersonnelForm.filter(tableData.value, searchForm)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载人员数据失败')
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  filteredData.value = PersonnelForm.filter(tableData.value, searchForm)
}

function handleReset() {
  searchForm.keyword = ''
  searchForm.status = ''
  filteredData.value = [...tableData.value]
}

onMounted(() => {
  void loadPersonnel()
})

function openDetail(row: PersonnelRecord) {
  currentRecord.value = row
  detailVisible.value = true
}

function handleDetailClosed() {
  currentRecord.value = null
}

function handlePersonnelUpdated(record: PersonnelRecord) {
  const index = tableData.value.findIndex((item) => item.id === record.id)
  if (index !== -1) {
    tableData.value[index] = record
  }
  currentRecord.value = record
  handleSearch()
}

function handlePersonnelDeleted(id: string) {
  tableData.value = tableData.value.filter((item) => item.id !== id)
  currentRecord.value = null
  handleSearch()
}

function openCreateDialog() {
  createVisible.value = true
}

function handlePersonnelCreated(record: PersonnelRecord) {
  tableData.value.unshift(record)
  handleSearch()
  const key = PersonnelForm.normalizeWorkshopKey(record.workshop)
  if (workshopTabs.value.some((tab) => tab.key === key)) {
    activeWorkshop.value = key
  }
}

async function handleExportCsv() {
  exporting.value = true
  try {
    await downloadPersonnelCsvTemplate()
    ElMessage.success('CSV 模板已下载，填写后可通过「导入 CSV」上传')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '导出失败')
  } finally {
    exporting.value = false
  }
}

function triggerImport() {
  fileInputRef.value?.click()
}

async function handleImportFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  importing.value = true
  try {
    const result = await importPersonnelCsv(file)
    tableData.value = result.items
    handleSearch()
    ElMessage.success(result.message || '导入成功')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '导入失败')
  } finally {
    importing.value = false
  }
}

function handleCreateCommand(command: string) {
  if (command === 'manual') {
    openCreateDialog()
    return
  }
  if (command === 'export') {
    void handleExportCsv()
    return
  }
  if (command === 'import') {
    triggerImport()
  }
}
</script>

<template>
  <el-card shadow="never">
    <template #header>
      <div class="card-header">
        <span>人员</span>
        <el-dropdown
          v-if="canEdit"
          trigger="click"
          :disabled="exporting || importing"
          @command="handleCreateCommand"
        >
          <el-button type="primary" :loading="exporting || importing">
            新建
            <el-icon class="el-icon--right"><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="manual" :icon="EditPen">手动新建</el-dropdown-item>
              <el-dropdown-item command="export" :icon="Download" divided>
                导出 CSV 模板
              </el-dropdown-item>
              <el-dropdown-item command="import" :icon="Upload">导入 CSV</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </template>

    <input
      ref="fileInputRef"
      type="file"
      accept=".csv,text/csv"
      class="hidden-file-input"
      @change="handleImportFile"
    />

    <el-form :inline="true" :model="searchForm" class="search-form">
      <el-form-item label="关键词">
        <el-input
          v-model="searchForm.keyword"
          placeholder="姓名 / 工号 / 国籍 / 岗位 / 电话 / 宿舍号"
          clearable
          style="width: 280px"
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

    <el-tabs v-model="activeWorkshop" class="workshop-tabs">
      <el-tab-pane
        v-for="tab in workshopTabs"
        :key="tab.key"
        :name="tab.key"
        :label="`${tab.label}（${tab.count}）`"
      />
    </el-tabs>

    <template v-if="workshopTabs.length">
      <PersonnelTable
        v-if="!isGrouped"
        :data="workshopData"
        :loading="loading"
        :show-workshop="false"
        :show-team="true"
        :show-nationality="true"
        :show-dormitory="true"
        @row-click="openDetail"
        @detail="openDetail"
      />

      <div v-else v-loading="loading" class="record-group-list">
        <div v-for="group in recordGroups" :key="group.key" class="record-section">
          <div class="record-section-header">
            <span class="record-section-title">{{ group.label }}</span>
            <span class="record-section-count">
              在职 {{ countByStatus(group.members, 'active') }} 人 · 离职
              {{ countByStatus(group.members, 'inactive') }} 人
            </span>
          </div>
          <PersonnelTable
            :data="group.members"
            :show-workshop="false"
            :show-team="groupBy !== 'team'"
            :show-nationality="groupBy !== 'nationality'"
            :show-dormitory="groupBy !== 'dormitory'"
            @row-click="openDetail"
            @detail="openDetail"
          />
        </div>
        <el-empty v-if="!recordGroups.length" description="暂无匹配人员" />
      </div>
    </template>
    <el-empty v-else v-loading="loading" description="暂无匹配人员" />
  </el-card>

  <PersonnelDetailDrawer
    v-model="detailVisible"
    :record="currentRecord"
    @updated="handlePersonnelUpdated"
    @deleted="handlePersonnelDeleted"
    @closed="handleDetailClosed"
  />

  <PersonnelFormDialog v-model="createVisible" @created="handlePersonnelCreated" />
</template>

<style scoped>
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.search-form {
  margin-bottom: 8px;
}

.workshop-tabs {
  margin-bottom: 12px;
}

.workshop-tabs :deep(.el-tabs__header) {
  margin-bottom: 0;
}

.hidden-file-input {
  display: none;
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
</style>
