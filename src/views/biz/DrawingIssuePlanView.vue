<script setup lang="ts">
import '@/styles/biz-page-card.css'
import { computed, onMounted, ref } from 'vue'
import { Plus, Setting, Upload } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import {
  batchSaveDrawingIssuePlan,
  downloadDrawingIssuePlanExcel,
  fetchDrawingIssuePlanList,
  fetchDrawingIssuePlanSettings,
  importDrawingIssuePlanExcel,
  saveDrawingIssuePlanSettings,
} from '@/api/drawingIssuePlan'
import { fetchProjectList } from '@/api/projects'
import DrawingIssuePlanMonthSwitcher from '@/components/biz/DrawingIssuePlanMonthSwitcher.vue'
import DrawingIssuePlanProjectPicker from '@/components/biz/DrawingIssuePlanProjectPicker.vue'
import DrawingIssuePlanSettingsDialog from '@/components/biz/DrawingIssuePlanSettingsDialog.vue'
import DrawingIssuePlanTable from '@/components/biz/DrawingIssuePlanTable.vue'
import {
  DrawingIssuePlanForm,
  type DrawingIssuePlanRow,
} from '@/models/biz/drawingIssuePlan/DrawingIssuePlanForm'
import {
  DrawingIssuePlanSettings,
  type DrawingIssuePlanPageSettings,
} from '@/models/biz/drawingIssuePlan/DrawingIssuePlanSettings'
import type { ProjectRecord } from '@/models/biz/project'
import { getUser, isAdminUser } from '@/utils/auth'
import { canEditPage } from '@/utils/permission'

const currentYear = ref(DrawingIssuePlanForm.getCurrentYear())
const currentMonth = ref(DrawingIssuePlanForm.getCurrentMonth())
const loading = ref(false)
const saving = ref(false)
const importing = ref(false)
const exporting = ref(false)
const pickerVisible = ref(false)
const settingsVisible = ref(false)
const pageSettings = ref<DrawingIssuePlanPageSettings>(DrawingIssuePlanSettings.createDefault())
const planRows = ref<DrawingIssuePlanRow[]>([])
const projectMap = ref(new Map<string, ProjectRecord>())
const fileInputRef = ref<HTMLInputElement | null>(null)

const canEdit = computed(() => canEditPage('drawing-issue-plan'))
const isAdmin = computed(() => isAdminUser(getUser()))
const pageTitle = computed(() => DrawingIssuePlanForm.buildTitle(currentYear.value, currentMonth.value))
const totalWeight = computed(() => DrawingIssuePlanForm.sumWeight(planRows.value))
const excludedProjectNos = computed(() => [...DrawingIssuePlanForm.collectProjectNos(planRows.value)])
const approachingDays = computed(() => pageSettings.value.approachingDays)

function openSettings() {
  settingsVisible.value = true
}

function handleSettingsSave(settings: DrawingIssuePlanPageSettings) {
  const next = DrawingIssuePlanSettings.normalize(settings)
  pageSettings.value = next
  void persistPageSettings(next)
}

async function loadPageSettings() {
  try {
    const remote = await fetchDrawingIssuePlanSettings()
    pageSettings.value = DrawingIssuePlanSettings.normalize(remote)
    return
  } catch {
    // 回退本地缓存，兼容旧版本
  }
  pageSettings.value = DrawingIssuePlanSettings.loadLocal()
}

async function persistPageSettings(settings: DrawingIssuePlanPageSettings) {
  try {
    const saved = await saveDrawingIssuePlanSettings(settings)
    pageSettings.value = DrawingIssuePlanSettings.normalize(saved)
    ElMessage.success('页面配置已保存')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存页面配置失败')
  }
}

async function loadProjects() {
  const result = await fetchProjectList({ all: true })
  projectMap.value = DrawingIssuePlanForm.buildProjectMap(result.list)
}

async function loadPlans() {
  loading.value = true
  try {
    const records = await fetchDrawingIssuePlanList({
      year: currentYear.value,
      month: currentMonth.value,
    })
    planRows.value = DrawingIssuePlanForm.enrichRows(records, projectMap.value)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载细化发图计划失败')
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
    ElMessage.error(error instanceof Error ? error.message : '加载细化发图计划失败')
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
  planRows.value = DrawingIssuePlanForm.appendProjects(
    planRows.value,
    projects,
    currentYear.value,
    currentMonth.value,
  )
  ElMessage.success(`已添加 ${projects.length} 个项目`)
}

function removeRow(index: number) {
  planRows.value.splice(index, 1)
  planRows.value = DrawingIssuePlanForm.normalizeRows(
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
      const payload = DrawingIssuePlanForm.buildSavePayload(
        planRows.value,
        currentYear.value,
        currentMonth.value,
      )
      const saved = await batchSaveDrawingIssuePlan(payload)
      planRows.value = DrawingIssuePlanForm.enrichRows(saved, projectMap.value)
    } while (saveQueued)
    ElMessage.success(successMessage)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

async function handleSave() {
  await persistPlans('细化发图计划已保存')
}

async function handleDateAutoSave() {
  if (!canEdit.value) return
  await persistPlans('日期已保存')
}

async function handleExport() {
  exporting.value = true
  try {
    await downloadDrawingIssuePlanExcel(currentYear.value, currentMonth.value)
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
    const saved = await importDrawingIssuePlanExcel(
      file,
      currentYear.value,
      currentMonth.value,
    )
    planRows.value = DrawingIssuePlanForm.enrichRows(saved, projectMap.value)
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

    <DrawingIssuePlanMonthSwitcher
      :year="currentYear"
      :month="currentMonth"
      :current-count="planRows.length"
      :total-weight="totalWeight"
      :approaching-days="approachingDays"
      @change="handleMonthChange"
    />

    <div class="plan-view-body">
      <div class="table-scroll">
        <DrawingIssuePlanTable
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

  <DrawingIssuePlanProjectPicker
    v-model:visible="pickerVisible"
    :excluded-project-nos="excludedProjectNos"
    @confirm="handleProjectsSelected"
  />

  <DrawingIssuePlanSettingsDialog
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
