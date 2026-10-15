<script setup lang="ts">
import '@/styles/biz-page-card.css'
import { computed, onMounted, ref, watch } from 'vue'
import { Download, Plus, Upload, View } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  batchSaveSettlementRecords,
  downloadSettlementRecordsExcel,
  attachPendingItemsToMonth,
  moveMonthRecordsToPending,
  fetchSettlementPendingList,
  fetchSettlementPricingList,
  fetchSettlementRecordList,
  importSettlementPricingExcel,
  importSettlementRecordsExcel,
} from '@/api/settlement'
import SettlementPendingTable from '@/components/biz/SettlementPendingTable.vue'
import SettlementPricingDialog from '@/components/biz/SettlementPricingDialog.vue'
import SettlementRecordTable from '@/components/biz/SettlementRecordTable.vue'
import {
  SettlementRecordForm,
  type SettlementCategory,
  type SettlementPendingRow,
  type SettlementPricingRecord,
  type SettlementRecordRow,
} from '@/models/biz/settlement/SettlementRecordForm'
import { getUser, isAdminUser } from '@/utils/auth'
import { canEditPage } from '@/utils/permission'

const activeCategory = ref<SettlementCategory>(SettlementRecordForm.CATEGORY_DETAIL)
const currentYear = ref(SettlementRecordForm.getCurrentYear())
const currentMonth = ref(SettlementRecordForm.getCurrentMonth())
const loading = ref(false)
const pendingLoading = ref(false)
const saving = ref(false)
const exporting = ref(false)
const importing = ref(false)
const attachingPending = ref(false)
const movingMonth = ref(false)
const pricingLoading = ref(false)
const pricingVisible = ref(false)
const settlementRows = ref<SettlementRecordRow[]>([])
const pendingRows = ref<SettlementPendingRow[]>([])
const pricingByCategory = ref<Record<SettlementCategory, SettlementPricingRecord[]>>({
  detail: [],
  design: [],
})
const settlementFileInputRef = ref<HTMLInputElement | null>(null)
const pricingFileInputRef = ref<HTMLInputElement | null>(null)

const canEdit = computed(() => canEditPage('settlement-record'))
const isAdmin = computed(() => isAdminUser(getUser()))
const pageTitle = computed(() =>
  SettlementRecordForm.buildTitle(currentYear.value, currentMonth.value, activeCategory.value),
)
const currentPricingOptions = computed(() => pricingByCategory.value[activeCategory.value] ?? [])
const totalAmount = computed(() => SettlementRecordForm.sumTotalPrice(settlementRows.value))
const monthLabel = computed(() =>
  SettlementRecordForm.formatMonthLabel(currentYear.value, currentMonth.value),
)

function shiftMonth(delta: number) {
  const next = SettlementRecordForm.shiftMonth(currentYear.value, currentMonth.value, delta)
  currentYear.value = next.year
  currentMonth.value = next.month
}

async function loadPricing() {
  pricingLoading.value = true
  try {
    const [detail, design] = await Promise.all([
      fetchSettlementPricingList('detail'),
      fetchSettlementPricingList('design'),
    ])
    pricingByCategory.value = { detail, design }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载定价依据失败')
  } finally {
    pricingLoading.value = false
  }
}

async function loadPending() {
  pendingLoading.value = true
  try {
    const records = await fetchSettlementPendingList(activeCategory.value)
    const pricingMap = SettlementRecordForm.buildPricingMap(currentPricingOptions.value)
    pendingRows.value = SettlementRecordForm.enrichPendingRows(records, pricingMap)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载未结算项目失败')
  } finally {
    pendingLoading.value = false
  }
}

async function loadRecords() {
  loading.value = true
  try {
    const records = await fetchSettlementRecordList({
      year: currentYear.value,
      month: currentMonth.value,
      category: activeCategory.value,
    })
    const pricingMap = SettlementRecordForm.buildPricingMap(currentPricingOptions.value)
    settlementRows.value = SettlementRecordForm.enrichRows(records, pricingMap)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载结算记录失败')
  } finally {
    loading.value = false
  }
}

async function handleSave() {
  if (!canEdit.value) return
  saving.value = true
  try {
    const payload = SettlementRecordForm.buildSavePayload(
      settlementRows.value,
      currentYear.value,
      currentMonth.value,
      activeCategory.value,
    )
    const saved = await batchSaveSettlementRecords(payload)
    const pricingMap = SettlementRecordForm.buildPricingMap(currentPricingOptions.value)
    settlementRows.value = SettlementRecordForm.enrichRows(saved, pricingMap)
    ElMessage.success('结算记录已保存')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

function addRow() {
  settlementRows.value.push(
    SettlementRecordForm.createEmptyRow(
      currentYear.value,
      currentMonth.value,
      activeCategory.value,
      settlementRows.value.length + 1,
    ),
  )
}

function removeRow(index: number) {
  settlementRows.value.splice(index, 1)
  settlementRows.value = SettlementRecordForm.normalizeRows(
    settlementRows.value,
    currentYear.value,
    currentMonth.value,
    activeCategory.value,
  )
}

async function handleExport() {
  exporting.value = true
  try {
    await downloadSettlementRecordsExcel(
      currentYear.value,
      currentMonth.value,
      activeCategory.value,
    )
    ElMessage.success('导出成功')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '导出失败')
  } finally {
    exporting.value = false
  }
}

async function handleAttachPendingToMonth() {
  if (!canEdit.value) return
  if (pendingRows.value.length === 0) {
    ElMessage.info('暂无未结算项目可以加入当月')
    return
  }

  try {
    await ElMessageBox.confirm(
      '确定把当前 Tab 的所有“已完成未结算”项目加入当月结算吗？加入后对应未结算数据会被删除。',
      '确认操作',
      { type: 'warning' },
    )
  } catch {
    return
  }

  attachingPending.value = true
  try {
    await attachPendingItemsToMonth({
      year: currentYear.value,
      month: currentMonth.value,
      category: activeCategory.value,
    })
    ElMessage.success('已加入当月结算')
    await Promise.all([loadPending(), loadRecords()])
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '操作失败')
  } finally {
    attachingPending.value = false
  }
}

async function handleMoveMonthToPending() {
  if (!canEdit.value) return
  if (settlementRows.value.length === 0) {
    ElMessage.info('当月暂无结算数据可以移动到未结算')
    return
  }

  try {
    await ElMessageBox.confirm(
      '确定把当前 Tab 的当月结算记录移动到“已完成未结算”吗？移动后当月结算数据会被删除。',
      '确认操作',
      { type: 'warning' },
    )
  } catch {
    return
  }

  movingMonth.value = true
  try {
    await moveMonthRecordsToPending({
      year: currentYear.value,
      month: currentMonth.value,
      category: activeCategory.value,
    })
    ElMessage.success('已移动到未结算')
    await Promise.all([loadPending(), loadRecords()])
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '操作失败')
  } finally {
    movingMonth.value = false
  }
}

function triggerSettlementImport() {
  settlementFileInputRef.value?.click()
}

function triggerPricingImport() {
  pricingFileInputRef.value?.click()
}

async function handleSettlementImportChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  importing.value = true
  try {
    await importSettlementRecordsExcel(
      file,
      currentYear.value,
      currentMonth.value,
      activeCategory.value,
    )
    ElMessage.success('结算记录导入成功')
    await loadRecords()
    await loadPending()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '导入失败')
  } finally {
    importing.value = false
  }
}

async function handlePricingImportChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  importing.value = true
  try {
    await importSettlementPricingExcel(file)
    ElMessage.success('定价依据导入成功')
    await loadPricing()
    await loadRecords()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '导入失败')
  } finally {
    importing.value = false
  }
}

watch([currentYear, currentMonth, activeCategory], () => {
  void loadRecords()
  void loadPending()
})

onMounted(async () => {
  await loadPricing()
  await Promise.all([loadRecords(), loadPending()])
})
</script>

<template>
  <div class="biz-page-card settlement-record-view">
    <el-card shadow="never">
      <template #header>
        <div class="card-header">
          <div class="card-header-main">
            <h2>钢结构技术科项目结算</h2>
            <p class="card-subtitle">按定价依据维护细化结算与设计结算，支持 Excel 导入导出</p>
          </div>
          <div class="card-header-actions">
            <el-button :icon="View" @click="pricingVisible = true">定价依据</el-button>
            <el-button :loading="exporting" :icon="Download" @click="handleExport">导出</el-button>
            <el-button
              v-if="isAdmin"
              :loading="importing"
              :icon="Upload"
              @click="triggerSettlementImport"
            >
              导入结算
            </el-button>
            <el-button
              v-if="isAdmin"
              :loading="importing"
              :icon="Upload"
              @click="triggerPricingImport"
            >
              导入定价表
            </el-button>
            <el-button v-if="canEdit" type="primary" :icon="Plus" @click="addRow">新增</el-button>
            <el-button v-if="canEdit" type="primary" :loading="saving" @click="handleSave">
              保存
            </el-button>
            <el-button
              v-if="canEdit"
              type="danger"
              :loading="movingMonth"
              @click="handleMoveMonthToPending"
            >
              当月→未结算
            </el-button>
          </div>
        </div>
      </template>

      <el-tabs v-model="activeCategory" class="settlement-tabs">
        <el-tab-pane
          v-for="tab in SettlementRecordForm.CATEGORY_TABS"
          :key="tab.key"
          :label="tab.label"
          :name="tab.key"
        />
      </el-tabs>

      <div class="settlement-toolbar">
        <div class="month-switcher">
          <el-button link aria-label="上一月" @click="shiftMonth(-1)">
            <el-icon><ArrowLeft /></el-icon>
          </el-button>
          <span class="month-label">{{ monthLabel }}</span>
          <el-button link aria-label="下一月" @click="shiftMonth(1)">
            <el-icon><ArrowRight /></el-icon>
          </el-button>
        </div>
        <span class="settlement-summary">
          {{ pageTitle }} · 共 {{ settlementRows.length }} 项，合计
          {{ SettlementRecordForm.formatAmount(totalAmount) }} 美元
        </span>
      </div>

      <SettlementRecordTable
        :data="settlementRows"
        :loading="loading"
        :can-edit="canEdit"
        :pricing-options="currentPricingOptions"
        @remove="removeRow"
      />

      <section class="pending-section">
        <div class="pending-header">
          <div class="pending-left">
            <h3>已完成未结算</h3>
            <span class="pending-summary">
              共 {{ pendingRows.length }} 项（有发图年月、尚无结算年月）
            </span>
          </div>
          <div class="pending-actions">
            <el-button
              v-if="canEdit"
              type="primary"
              :loading="attachingPending"
              @click="handleAttachPendingToMonth"
            >
              未结算→当月
            </el-button>
          </div>
        </div>
        <SettlementPendingTable :data="pendingRows" :loading="pendingLoading" />
      </section>
    </el-card>

    <SettlementPricingDialog
      v-model:visible="pricingVisible"
      :category="activeCategory"
      :pricing-list="currentPricingOptions"
      :loading="pricingLoading"
    />

    <input
      ref="settlementFileInputRef"
      type="file"
      accept=".xlsx,.xls"
      hidden
      @change="handleSettlementImportChange"
    />
    <input
      ref="pricingFileInputRef"
      type="file"
      accept=".xlsx,.xls"
      hidden
      @change="handlePricingImportChange"
    />
  </div>
</template>

<style scoped>
.settlement-record-view .card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.card-header-main h2 {
  margin: 0;
  font-size: 18px;
}

.card-subtitle {
  margin: 6px 0 0;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.card-header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.settlement-tabs {
  margin-bottom: 8px;
}

.settlement-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.month-switcher {
  display: flex;
  align-items: center;
  gap: 4px;
}

.month-label {
  min-width: 108px;
  text-align: center;
  font-size: 15px;
  font-weight: 600;
}

.settlement-summary {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.pending-section {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
}

.pending-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}

.pending-header h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--el-color-warning-dark-2);
}

.pending-summary {
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
</style>
