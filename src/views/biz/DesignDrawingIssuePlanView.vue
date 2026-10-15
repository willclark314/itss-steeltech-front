<script setup lang="ts">
import '@/styles/biz-page-card.css'
import { computed, onMounted, ref } from 'vue'
import { Plus, Setting, Upload } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import {
  batchSaveDesignDrawingIssuePlan,
  downloadDesignDrawingIssuePlanExcel,
  fetchDesignDrawingIssuePlanList,
  fetchDesignDrawingIssuePlanSettings,
  importDesignDrawingIssuePlanExcel,
  saveDesignDrawingIssuePlanSettings,
} from '@/api/designDrawingIssuePlan'
import { fetchProjectList } from '@/api/projects'
import DesignDrawingIssuePlanMonthSwitcher from '@/components/biz/DesignDrawingIssuePlanMonthSwitcher.vue'
import DesignDrawingIssuePlanProjectPicker from '@/components/biz/DesignDrawingIssuePlanProjectPicker.vue'
import DesignDrawingIssuePlanSettingsDialog from '@/components/biz/DesignDrawingIssuePlanSettingsDialog.vue'
import DesignDrawingIssuePlanTable from '@/components/biz/DesignDrawingIssuePlanTable.vue'
import {
  DesignDrawingIssuePlanForm,
  type DesignDrawingIssuePlanRow,
} from '@/models/biz/designDrawingIssuePlan/DesignDrawingIssuePlanForm'
import {
  DesignDrawingIssuePlanSettings,
  type DesignDrawingIssuePlanPageSettings,
} from '@/models/biz/designDrawingIssuePlan/DesignDrawingIssuePlanSettings'
import type { ProjectRecord } from '@/models/biz/project'
import { getUser, isAdminUser } from '@/utils/auth'
import { canEditPage } from '@/utils/permission'

const currentYear = ref(DesignDrawingIssuePlanForm.getCurrentYear())
const currentMonth = ref(DesignDrawingIssuePlanForm.getCurrentMonth())
const loading = ref(false)
const saving = ref(false)
const importing = ref(false)
const exporting = ref(false)
const pickerVisible = ref(false)
const settingsVisible = ref(false)
const pageSettings = ref<DesignDrawingIssuePlanPageSettings>(DesignDrawingIssuePlanSettings.createDefault())
const planRows = ref<DesignDrawingIssuePlanRow[]>([])
const projectMap = ref(new Map<string, ProjectRecord>())
const fileInputRef = ref<HTMLInputElement | null>(null)

const canEdit = computed(() => canEditPage('design-drawing-issue-plan'))
const isAdmin = computed(() => isAdminUser(getUser()))
const pageTitle = computed(() => DesignDrawingIssuePlanForm.buildTitle(currentYear.value, currentMonth.value))
const excludedProjectNos = computed(() => [...DesignDrawingIssuePlanForm.collectProjectNos(planRows.value)])
const approachingDays = computed(() => pageSettings.value.approachingDays)

function openSettings() {
  settingsVisible.value = true
}

function handleSettingsSave(settings: DesignDrawingIssuePlanPageSettings) {
  const next = DesignDrawingIssuePlanSettings.normalize(settings)
  pageSettings.value = next
  void persistPageSettings(next)
}

async function loadPageSettings() {
  try {
    const remote = await fetchDesignDrawingIssuePlanSettings()
    pageSettings.value = DesignDrawingIssuePlanSettings.normalize(remote)
    return
  } catch {
    // 回退本地缓存，兼容旧版本
  }
  pageSettings.value = DesignDrawingIssuePlanSettings.loadLocal()
}

async function persistPageSettings(settings: DesignDrawingIssuePlanPageSettings) {
  try {
    const saved = await saveDesignDrawingIssuePlanSettings(settings)
    pageSettings.value = DesignDrawingIssuePlanSettings.normalize(saved)
    ElMessage.success('页面配置已保存')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存页面配置失败')
  }
}

async function loadProjects() {
  const result = await fetchProjectList({ all: true })
  projectMap.value = DesignDrawingIssuePlanForm.buildProjectMap(result.list)
}

async function loadPlans() {
  loading.value = true
  try {
    const records = await fetchDesignDrawingIssuePlanList({
      year: currentYear.value,
      month: currentMonth.value,
    })
    planRows.value = DesignDrawingIssuePlanForm.enrichRows(records, projectMap.value)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载设计发图计划失败')
  } finally {
    loading.value = false
  }
}

async function reloadAll() {
  loading.value = true
  try {
    await loadProjects()
    await loadPlans()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载设计发图计划失败')
  } finally {
    loading.value = false
  }
}

function handleMonthChange(year: number, month: number) {
  currentYear.value = year
  currentMonth.value = month
  void loadPlans()
}

function openProjectPicker() {
  pickerVisible.value = true
}

function handleProjectsSelected(projects: ProjectRecord[]) {
  const before = planRows.value.length
  planRows.value = DesignDrawingIssuePlanForm.appendProjects(
    planRows.value,
    projects,
    currentYear.value,
    currentMonth.value,
  )
  const added = planRows.value.length - before
  if (!added) {
    ElMessage.warning('所选项目已在本月计划中')
    return
  }
  ElMessage.success(`已添加 ${added} 个项目`)
}

function removeRow(index: number) {
  planRows.value.splice(index, 1)
  planRows.value = DesignDrawingIssuePlanForm.normalizeRows(
    planRows.value,
    currentYear.value,
    currentMonth.value,
  )
}

let saveQueued = false

async function persistPlans(successMessage: string) {
  if (saving.value) {
    saveQueued = true
    return
  }

  saving.value = true
  try {
    do {
      saveQueued = false
      const payload = DesignDrawingIssuePlanForm.buildSavePayload(
        planRows.value,
        currentYear.value,
        currentMonth.value,
      )
      const saved = await batchSaveDesignDrawingIssuePlan(payload)
      planRows.value = DesignDrawingIssuePlanForm.enrichRows(saved, projectMap.value)
    } while (saveQueued)
    ElMessage.success(successMessage)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

async function handleSave() {
  await persistPlans('设计发图计划已保存')
}

async function handleDateAutoSave() {
  if (!canEdit.value) return
  await persistPlans('日期已保存')
}

async function handleExport() {
  exporting.value = true
  try {
    await downloadDesignDrawingIssuePlanExcel(currentYear.value, currentMonth.value)
    ElMessage.success('导出成功')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '导出失败')
  } finally {
    exporting.value = false
  }
}

function triggerImport() {
  fileInputRef.value?.click()
}

async function handleImportChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  importing.value = true
  try {
    const saved = await importDesignDrawingIssuePlanExcel(
      file,
      currentYear.value,
      currentMonth.value,
    )
    planRows.value = DesignDrawingIssuePlanForm.enrichRows(saved, projectMap.value)
    ElMessage.success('导入成功')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '导入失败')
  } finally {
    importing.value = false
  }
}

onMounted(() => {
  void loadPageSettings()
  void reloadAll()
})
</script>

<template>
  <el-card shadow="never" class="biz-page-card">
    <template #header>
      <div class="card-header">
        <div class="card-header__title">
          <span class="card-title">{{ pageTitle }}</span>
          <el-button
            link
            class="page-settings-btn"
            aria-label="页面配置"
            @click="openSettings"
          >
            <el-icon><Setting /></el-icon>
          </el-button>
        </div>
        <div class="card-header__actions">
          <el-button
            v-if="canEdit"
            type="primary"
            plain
            :icon="Plus"
            @click="openProjectPicker"
          >
            添加项目
          </el-button>
          <el-button
            v-if="canEdit"
            type="primary"
            :loading="saving"
            @click="handleSave"
          >
            保存
          </el-button>
          <el-button :loading="exporting" @click="handleExport">
            导出 Excel
          </el-button>
          <el-button
            v-if="isAdmin"
            :loading="importing"
            :icon="Upload"
            @click="triggerImport"
          >
            导入 Excel
          </el-button>
          <input
            ref="fileInputRef"
            type="file"
            accept=".xlsx,.xls"
            class="hidden-file-input"
            @change="handleImportChange"
          >
        </div>
      </div>
    </template>

    <DesignDrawingIssuePlanMonthSwitcher
      :year="currentYear"
      :month="currentMonth"
      :current-count="planRows.length"
      :approaching-days="approachingDays"
      @change="handleMonthChange"
    />

    <div class="plan-view-body">
      <div class="table-scroll">
        <DesignDrawingIssuePlanTable
          :data="planRows"
          :loading="loading"
          :can-edit="canEdit"
          :date-saving="saving"
          :approaching-days="approachingDays"
          :project-map="projectMap"
          table-height="100%"
          @remove="removeRow"
          @date-change="handleDateAutoSave"
        />
      </div>
    </div>
  </el-card>

  <DesignDrawingIssuePlanProjectPicker
    v-model:visible="pickerVisible"
    :excluded-project-nos="excludedProjectNos"
    @confirm="handleProjectsSelected"
  />

  <DesignDrawingIssuePlanSettingsDialog
    v-model="settingsVisible"
    :settings="pageSettings"
    @save="handleSettingsSave"
  />
</template>

<style scoped>
.page-settings-btn {
  margin-left: 2px;
  padding: 0 4px;
  color: var(--el-text-color-secondary);
}

.page-settings-btn:hover {
  color: var(--el-color-primary);
}

.card-header__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.plan-view-body {
  --plan-table-height: calc(100vh - 260px);
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.table-scroll {
  height: var(--plan-table-height);
  overflow: hidden;
}

.hidden-file-input {
  display: none;
}
</style>
