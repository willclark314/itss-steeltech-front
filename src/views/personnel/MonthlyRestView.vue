<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchPersonnelList } from '@/api/personnel'
import {
  batchSaveMonthlyRest,
  downloadMonthlyRestExcel,
  fetchMonthlyRestList,
  fetchMonthlyRestScope,
  fetchMonthlyRestStatus,
  finalizeMonthlyRest,
} from '@/api/monthlyRest'
import { PersonnelForm, MonthlyRestForm } from '@/models/personnel'
import { getUser, isAdminUser } from '@/utils/auth'
import type { PersonnelRecord, MonthlyRestRecord } from '@/models/personnel'

const currentYear = ref(MonthlyRestForm.getCurrentYear())
const currentMonth = ref(MonthlyRestForm.getCurrentMonth())
const loading = ref(false)
const saving = ref(false)
const dirty = ref(false)
const rowSavingId = ref<string | null>(null)
const isLocked = ref(false)
const scopeLoaded = ref(false)

const personnelList = ref<PersonnelRecord[]>([])
const restRecords = ref<MonthlyRestRecord[]>([])

/** reactive 对象：personnelId → 休息日期数组（当前工作状态） */
const restMap = reactive<Record<string, string[]>>({})

/** reactive 对象：personnelId → 已持久化到数据库的休息日期（快照） */
const savedMap = reactive<Record<string, string[]>>({})

const teamOptions = PersonnelForm.TEAM_OPTIONS

// ── 当前用户权限 ──
const currentUser = getUser()
const currentTeam = currentUser?.profile?.team || ''
const isAdmin = isAdminUser(currentUser)
const scopeEditablePersonnelIds = ref<string[]>([])
// 组长角色不启用，所有非管理员均为普通成员，只能编辑自己

/** 团队可见性 —— 管理员默认全部可见，普通成员只看自己组 */
const teamVisible = reactive<Record<string, boolean>>(
  isAdmin
    ? Object.fromEntries(teamOptions.map((t) => [t.value, true]))
    : { [currentTeam]: true },
)

/** 当前用户可编辑的人员 ID 列表 */
const editablePersonnelIds = computed(() => {
  if (scopeLoaded.value) return scopeEditablePersonnelIds.value
  if (isAdmin) return activePersonnel.value.map((p) => p.id)
  return []
})

function normalizeCompareValue(value?: string): string {
  return String(value ?? '').trim()
}

function isCurrentUserRow(row: { personnelId?: string; employeeNo?: string; name?: string }): boolean {
  const personnelIdCandidates = [
    currentUser?.personnelId,
    currentUser?.profile?.id,
  ]
    .map(normalizeCompareValue)
    .filter(Boolean)

  if (personnelIdCandidates.includes(normalizeCompareValue(row.personnelId))) {
    return true
  }

  const employeeNoCandidates = [
    currentUser?.employeeNo,
    currentUser?.profile?.employeeNo,
    currentUser?.username,
  ]
    .map(normalizeCompareValue)
    .filter(Boolean)

  if (employeeNoCandidates.includes(normalizeCompareValue(row.employeeNo))) {
    return true
  }

  const currentName = normalizeCompareValue(currentUser?.name || currentUser?.profile?.name)
  return Boolean(currentName && currentName === normalizeCompareValue(row.name))
}

/** 当前用户是否“属于”某人的行，用于决定是否显示按钮 */
function ownsRow(personnelId: string): boolean {
  return editablePersonnelIds.value.includes(personnelId)
}

function ownsRowData(row: { personnelId?: string; employeeNo?: string; name?: string }): boolean {
  return Boolean(row.personnelId && ownsRow(row.personnelId)) || isCurrentUserRow(row)
}

function shouldShowRowSaveButton(row: { personnelId?: string; employeeNo?: string; name?: string }): boolean {
  return ownsRowData(row)
}

/** 当前用户是否可以编辑某人的行 */
function canEditRow(personnelId: string): boolean {
  // 月休计划已定稿后，员工不可再改；管理员仍可继续调整并重新定稿
  if (isLocked.value && !isAdmin) return false
  return ownsRow(personnelId)
}

/** 当前选中月份的所有日期（1号到最后一天） */
const allDays = computed(() =>
  MonthlyRestForm.getAllDaysOfMonth(currentYear.value, currentMonth.value),
)

/** 仅周末日期（用于默认休息日和样式判断） */
const weekends = computed(() =>
  allDays.value.filter((d) => d.weekday === '周六' || d.weekday === '周日'),
)

/** 过滤后的在职人员 */
const activePersonnel = computed(() =>
  personnelList.value.filter((p) => p.status === 'active'),
)

/** 按团队分组后的表格行 */
const tableRows = computed(() => {
  const visibleTeams = new Set(
    Object.entries(teamVisible)
      .filter(([, v]) => v)
      .map(([k]) => k),
  )

  return activePersonnel.value
    .filter((p) => visibleTeams.has(p.team))
    .map((p) => ({
      personnelId: p.id,
      name: p.name,
      employeeNo: p.employeeNo,
      team: p.team,
      position: p.position,
    }))
    .sort((a, b) => {
      if (a.team !== b.team) return a.team.localeCompare(b.team, 'zh-CN')
      return a.name.localeCompare(b.name, 'zh-CN')
    })
})

/** 判断某人员在某日期是否休息 */
function isRestDay(personnelId: string, dateStr: string): boolean {
  return (restMap[personnelId] ?? []).includes(dateStr)
}

/** 判断某人员在某日期的休息是否已保存到数据库 */
function isSavedDay(personnelId: string, dateStr: string): boolean {
  return (savedMap[personnelId] ?? []).includes(dateStr)
}

/**
 * 休息日格子的显示状态（互斥，与 CSS 一一对应）：
 * - is-rest：绿色，未落库（含默认周日、本地修改未保存）
 * - is-saved：蓝色，员工已保存且当月未定稿
 * - is-finalized：紫色，已落库且当月已定稿
 */
function getRestCellStatusClass(personnelId: string, dateStr: string): string {
  if (!isRestDay(personnelId, dateStr)) return ''
  if (!isSavedDay(personnelId, dateStr)) return 'is-rest'
  if (isLocked.value) return 'is-finalized'
  return 'is-saved'
}

/** 判断某人员本月休息日是否有未保存的修改 */
function hasRowChanges(personnelId: string): boolean {
  const current = [...(restMap[personnelId] ?? [])].sort()
  const saved = [...(savedMap[personnelId] ?? [])].sort()
  if (current.length !== saved.length) return true
  return current.some((d, idx) => d !== saved[idx])
}

/** 同一周内另一个周末日的日期字符串 */
function getSiblingWeekend(dateStr: string): string | null {
  const parts = dateStr.split('-')
  const y = parseInt(parts[0]!)
  const m = parseInt(parts[1]!) - 1
  const d = parseInt(parts[2]!)
  const date = new Date(y, m, d)
  const dayOfWeek = date.getDay() // 0=周日, 6=周六

  if (dayOfWeek !== 6 && dayOfWeek !== 0) return null

  const sibling = new Date(y, m, d)
  // 周六 → 同周周日（+1天）；周日 → 同周周六（-1天）
  sibling.setDate(sibling.getDate() + (dayOfWeek === 6 ? 1 : -1))

  // 确保兄弟日也在同一个月内
  if (sibling.getMonth() !== m || sibling.getFullYear() !== y) return null

  return MonthlyRestForm.formatDate(sibling)
}

/** 切换休息日 */
function toggleRestDay(personnelId: string, dateStr: string) {
  if (!MonthlyRestForm.isWeekend(dateStr)) return
  if (!canEditRow(personnelId)) return

  if (!restMap[personnelId]) {
    restMap[personnelId] = []
  }

  const arr = restMap[personnelId]!
  const idx = arr.indexOf(dateStr)
  if (idx >= 0) {
    arr.splice(idx, 1)
  } else {
    // 同一周内只能选周六或周日其一，先移除同周另一个周末日
    const sibling = getSiblingWeekend(dateStr)
    if (sibling) {
      const siblingIdx = arr.indexOf(sibling)
      if (siblingIdx >= 0) {
        arr.splice(siblingIdx, 1)
      }
    }
    arr.push(dateStr)
    arr.sort()
  }

  dirty.value = true
}

/** 获取当前月份所有周日 */
function getCurrentMonthSundays(): string[] {
  return allDays.value
    .filter((d) => d.weekday === '周日')
    .map((d) => d.date)
}

/** 加载数据 */
async function loadData() {
  loading.value = true
  try {
    // 先清空脏状态，后续由 initRestMap 根据真实数据重新计算
    dirty.value = false
    const [personnel, records, status, scope] = await Promise.all([
      fetchPersonnelList(),
      fetchMonthlyRestList({ year: currentYear.value, month: currentMonth.value }),
      fetchMonthlyRestStatus(currentYear.value, currentMonth.value),
      fetchMonthlyRestScope(),
    ])
    personnelList.value = personnel
    restRecords.value = records
    isLocked.value = status.locked === true
    scopeEditablePersonnelIds.value = scope.editablePersonnelIds ?? []
    scopeLoaded.value = true
    initRestMap(records)
  } catch (error) {
    scopeLoaded.value = false
    ElMessage.error(error instanceof Error ? error.message : '加载数据失败')
  } finally {
    loading.value = false
  }
}

/** 根据已有记录初始化 restMap 和 savedMap */
function initRestMap(records: MonthlyRestRecord[]) {
  // 清空旧数据
  for (const key of Object.keys(restMap)) {
    delete restMap[key]
  }
  for (const key of Object.keys(savedMap)) {
    delete savedMap[key]
  }

  const defaultSundays = getCurrentMonthSundays()
  const recordPersonnelIds = new Set(records.map((r) => r.personnelId))

  // 填充已有记录（同时写入 savedMap 作为数据库快照）
  for (const record of records) {
    restMap[record.personnelId] = [...record.restDays]
    savedMap[record.personnelId] = [...record.restDays]
  }

  // 无记录的在职人员：默认全部周日休息（只写 restMap，不写 savedMap）
  let hasDefaulted = false
  for (const person of activePersonnel.value) {
    if (!recordPersonnelIds.has(person.id)) {
      restMap[person.id] = [...defaultSundays]
      // 只有自己能编辑的人员才标记为 dirty
      if (canEditRow(person.id)) {
        hasDefaulted = true
      }
    }
  }

  if (hasDefaulted) {
    dirty.value = true
  }
}

/** 保存 */
async function handleSave() {
  if (!tableRows.value.length) {
    ElMessage.warning('当前没有可保存的人员计划')
    return
  }

  saving.value = true
  try {
    // 只保存当前用户有权修改的人员记录
    const records: MonthlyRestRecord[] = tableRows.value
      .filter((row) => canEditRow(row.personnelId))
      .map((row) => ({
        id: `${row.personnelId}_${currentYear.value}_${String(currentMonth.value).padStart(2, '0')}`,
        personnelId: row.personnelId,
        year: currentYear.value,
        month: currentMonth.value,
        restDays: [...(restMap[row.personnelId] ?? [])].sort(),
      }))

    // 管理员保存=定稿锁定：保存后员工不可再修改
    await finalizeMonthlyRest(records)
    await loadData()
    ElMessage.success('月休计划已保存并定稿')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    saving.value = false
  }
}

/** 保存单个人员的月休计划（表格行“保存”按钮使用） */
async function handleSaveRow(personnelId: string) {
  if (!canEditRow(personnelId)) return
  if (isLocked.value) return

  // 若当前行无变更则不提交
  if (!hasRowChanges(personnelId)) return

  rowSavingId.value = personnelId
  try {
    const record: MonthlyRestRecord = {
      id: `${personnelId}_${currentYear.value}_${String(currentMonth.value).padStart(2, '0')}`,
      personnelId,
      year: currentYear.value,
      month: currentMonth.value,
      restDays: [...(restMap[personnelId] ?? [])].sort(),
    }

    await batchSaveMonthlyRest([record])

    // 本地快照与数据库对齐
    savedMap[personnelId] = [...record.restDays]

    // 若所有行都无变更，则整体状态设为未脏
    if (!tableRows.value.some((row) => hasRowChanges(row.personnelId))) {
      dirty.value = false
    }

    ElMessage.success('已保存当前人员的月休计划')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '保存失败')
  } finally {
    rowSavingId.value = null
  }
}

/** 导出 Excel */
const exporting = ref(false)
async function handleExport() {
  exporting.value = true
  try {
    await downloadMonthlyRestExcel(currentYear.value, currentMonth.value)
    ElMessage.success('导出成功')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '导出失败')
  } finally {
    exporting.value = false
  }
}

/** 切换月份 */
function changeMonth(delta: number) {
  let newMonth = currentMonth.value + delta
  let newYear = currentYear.value
  if (newMonth > 12) {
    newMonth = 1
    newYear++
  } else if (newMonth < 1) {
    newMonth = 12
    newYear--
  }
  currentYear.value = newYear
  currentMonth.value = newMonth
  void loadData()
}

/** 切换团队可见 */
function toggleTeam(team: string) {
  teamVisible[team] = !teamVisible[team]
}

/** 获取某人的休息日总数 */
function getRestCount(personnelId: string): number {
  return (restMap[personnelId] ?? []).length
}

/** 值班警告：每个组每个周末日至少有一人不休息（值班） */
interface DutyWarning {
  team: string
  date: string
  day: number
  weekday: string
  label: string
}

const dutyWarnings = computed(() => {
  const warnings: DutyWarning[] = []
  const visibleTeams = new Set(
    Object.entries(teamVisible)
      .filter(([, v]) => v)
      .map(([k]) => k),
  )

  for (const team of visibleTeams) {
    const teamMembers = activePersonnel.value.filter((p) => p.team === team)
    if (teamMembers.length === 0) continue

    for (const dayInfo of weekends.value) {
      const allResting = teamMembers.every((m) =>
        (restMap[m.id] ?? []).includes(dayInfo.date),
      )
      if (allResting) {
        warnings.push({
          team,
          date: dayInfo.date,
          day: dayInfo.day,
          weekday: dayInfo.weekday,
          label: `${currentMonth.value}月${dayInfo.day}日${dayInfo.weekday}`,
        })
      }
    }
  }

  return warnings
})

/** 按班组分组后的值班警告 */
const dutyWarningsByTeam = computed(() => {
  const map = new Map<string, string[]>()
  for (const w of dutyWarnings.value) {
    if (!map.has(w.team)) map.set(w.team, [])
    map.get(w.team)!.push(w.label)
  }
  return Array.from(map.entries()).map(([team, dates]) => ({ team, dates }))
})

/** 月份标签 */
const monthLabel = computed(() => `${currentYear.value}年${currentMonth.value}月`)

/** 休息天数列宽（用数字绑定，避免 EP 把字符串 width 当弹性列处理） */
const REST_COUNT_COL_WIDTH = 50

/** 根据当月天数动态计算列宽 */
const columnWidth = computed(() => {
  const count = allDays.value.length
  if (count <= 28) return 38
  if (count === 29) return 37
  if (count === 30) return 36
  return 34
})

onMounted(() => {
  void loadData()
})
</script>

<template>
  <div class="monthly-rest-page">
    <!-- 工具栏 -->
    <div class="toolbar">
      <div class="month-switcher">
        <el-button link @click="changeMonth(-1)">
          <el-icon><ArrowLeft /></el-icon>
        </el-button>
        <span class="month-label">{{ monthLabel }}</span>
        <el-button link @click="changeMonth(1)">
          <el-icon><ArrowRight /></el-icon>
        </el-button>
      </div>

      <div v-if="isAdmin" class="team-filters">
        <el-check-tag
          v-for="team in teamOptions"
          :key="team.value"
          :checked="teamVisible[team.value]"
          size="small"
          @change="toggleTeam(team.value)"
        >
          {{ team.label }}
        </el-check-tag>
      </div>

      <div class="hint-row">
        <div class="table-hint">
          <el-icon><InfoFilled /></el-icon>
          点击方格切换休息日，仅<strong>周六、周日</strong>可选
        </div>
        <div v-if="dutyWarningsByTeam.length > 0" class="duty-hints">
          <div
            v-for="group in dutyWarningsByTeam"
            :key="group.team"
            class="duty-hint"
          >
            <el-icon><WarningFilled /></el-icon>
            <span>{{ group.team }}：{{ group.dates.join('、') }} 没有人值班，请安排至少一人值班</span>
          </div>
        </div>
      </div>

      <div class="toolbar-right">
        <el-button
          v-if="isAdmin"
          size="small"
          :loading="exporting"
          @click="handleExport"
        >
          导出 Excel
        </el-button>
        <el-button
          v-if="isAdmin"
          type="primary"
          size="small"
          :loading="saving"
          :disabled="tableRows.length === 0"
          @click="handleSave"
        >
          保存计划
        </el-button>
      </div>
    </div>

    <!-- 数据表格 -->
    <div class="table-wrapper" v-loading="loading">
      <el-table
        :data="tableRows"
        border
        stripe
        size="small"
        height="100%"
        :fit="false"
        class="rest-table"
      >
        <!-- 固定列：序号 -->
        <el-table-column
          fixed="left"
          type="index"
          label="序号"
          width="30"
          align="center"
        />

        <!-- 固定列：姓名 -->
        <el-table-column
          fixed="left"
          prop="name"
          label="姓名"
          width="80"
        />

        <!-- 固定列：班组 -->
        <el-table-column
          fixed="left"
          prop="team"
          label="班组"
          width="55"
          align="center"
        />

        <!-- 固定列：休息日数 -->
        <el-table-column
          fixed="left"
          class-name="rest-count-col"
          :width="REST_COUNT_COL_WIDTH"
          align="center"
        >
          <template #header>
            <span class="rest-count-header">休息<br>天数</span>
          </template>
          <template #default="{ row }">
            <span
              class="rest-count"
              :class="{ 'is-active': getRestCount(row.personnelId) > 0 }"
            >
              {{ getRestCount(row.personnelId) }}
            </span>
          </template>
        </el-table-column>

        <!-- 动态列：每月每一天一列 -->
        <el-table-column
          v-for="dayInfo in allDays"
          :key="dayInfo.date"
          :width="columnWidth"
          align="center"
        >
          <template #header>
            <div class="day-header" :class="{ 'is-weekend': dayInfo.weekday === '周六' || dayInfo.weekday === '周日' }">
              <span class="day-date">{{ dayInfo.day }}</span>
              <span class="day-label">{{ dayInfo.weekday }}</span>
            </div>
          </template>

          <template #default="{ row }">
            <div
              v-if="dayInfo.weekday === '周六' || dayInfo.weekday === '周日'"
              class="rest-cell"
              :class="[
                getRestCellStatusClass(row.personnelId, dayInfo.date),
                {
                  'is-saturday': dayInfo.weekday === '周六',
                  'is-sunday': dayInfo.weekday === '周日',
                  'is-readonly': !canEditRow(row.personnelId),
                },
              ]"
              @click="canEditRow(row.personnelId) && toggleRestDay(row.personnelId, dayInfo.date)"
            >
              <el-icon v-if="isRestDay(row.personnelId, dayInfo.date)" :size="12">
                <Check />
              </el-icon>
            </div>
            <div v-else class="weekday-cell" />
          </template>
        </el-table-column>

        <!-- 操作列：普通用户按行保存 -->
        <el-table-column
          fixed="right"
          label="操作"
          width="80"
          align="center"
        >
          <template #default="{ row }">
            <el-button
              v-if="shouldShowRowSaveButton(row)"
              type="primary"
              size="small"
              :loading="rowSavingId === row.personnelId"
              :disabled="isLocked || !hasRowChanges(row.personnelId)"
              @click="handleSaveRow(row.personnelId)"
            >
              保存
            </el-button>
          </template>
        </el-table-column>

        <!-- 空状态 -->
        <template #empty>
          <el-empty description="暂无在职人员数据" />
        </template>
      </el-table>
    </div>
  </div>
</template>

<style scoped>
.monthly-rest-page {
  padding: 0;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 48px - 40px - 50px);
  min-height: 400px;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-shrink: 0;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.hint-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.duty-hints {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.duty-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--el-color-warning);
}

.duty-hint .el-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.month-switcher {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.month-label {
  min-width: 80px;
  text-align: center;
  font-size: 16px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.team-filters {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-left: auto;
}

.table-hint {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
  white-space: nowrap;
}

.table-hint .el-icon {
  font-size: 14px;
}

.table-wrapper {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.rest-table {
  height: 100%;
}

.rest-table :deep(.el-table__header th) {
  padding: 2px 2px;
}

.rest-table :deep(.el-table__header th .cell) {
  padding: 1px 2px;
  line-height: 1.2;
}

.rest-table :deep(.el-table__body td) {
  padding: 0;
}

.rest-table :deep(.el-table__body td .cell) {
  padding: 1px 2px;
  line-height: 1;
}

.rest-table :deep(.rest-count-col.el-table__cell) {
  width: v-bind('`${REST_COUNT_COL_WIDTH}px`') !important;
  min-width: v-bind('`${REST_COUNT_COL_WIDTH}px`') !important;
  max-width: v-bind('`${REST_COUNT_COL_WIDTH}px`') !important;
}

.rest-count-header {
  display: inline-block;
  font-size: 11px;
  line-height: 1.15;
  white-space: normal;
}

.rest-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border-radius: 9px;
  font-size: 11px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
  background: var(--el-fill-color);
}

.rest-count.is-active {
  color: var(--el-color-success);
  background: var(--el-color-success-light-8);
}

.day-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.2;
}

.day-header.is-weekend {
  color: var(--el-color-danger);
}

.day-date {
  font-size: 12px;
  font-weight: 600;
}

.day-label {
  font-size: 10px;
  color: var(--el-text-color-secondary);
}

.day-header.is-weekend .day-label {
  color: var(--el-color-danger);
}

.weekday-cell {
  width: 100%;
  min-height: 22px;
  background: var(--el-fill-color-lighter);
  border-radius: 2px;
}

.rest-cell {
  width: 100%;
  height: 100%;
  min-height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 3px;
  transition: background-color 0.15s, border-color 0.15s;
  border: 1px solid transparent;
  user-select: none;
}

.rest-cell:hover {
  border-color: var(--el-color-primary-light-5);
  background: var(--el-color-primary-light-9);
}

.rest-cell.is-saturday {
  background: var(--el-fill-color-lighter);
}

.rest-cell.is-sunday {
  background: var(--el-fill-color-extra-light);
}

.rest-cell.is-rest {
  background: var(--el-color-success-light-7);
  border-color: var(--el-color-success);
}

.rest-cell.is-rest:hover {
  background: var(--el-color-success-light-6);
}

.rest-cell.is-rest .el-icon {
  color: var(--el-color-success);
}

/* 已保存到数据库的休息日：蓝色背景（员工保存后） */
.rest-cell.is-saved {
  background: var(--el-color-primary-light-7);
  border-color: var(--el-color-primary);
}

.rest-cell.is-saved:hover {
  background: var(--el-color-primary-light-6);
}

.rest-cell.is-saved .el-icon {
  color: var(--el-color-primary);
}

/* 已定稿（管理员保存计划后）：紫色边框 + 淡紫底 */
.rest-cell.is-finalized,
.rest-cell.is-finalized.is-saturday,
.rest-cell.is-finalized.is-sunday {
  background: #a59bd2;
  border-color: #7c3aed;
}

.rest-cell.is-finalized:hover,
.rest-cell.is-finalized.is-saturday:hover,
.rest-cell.is-finalized.is-sunday:hover {
  background: #ddd6fe;
}

.rest-cell.is-finalized .el-icon {
  color: #7c3aed;
}

/* 无编辑权限的行：降低不透明度，禁用点击（定稿紫色格保持正常亮度） */
.rest-cell.is-readonly:not(.is-finalized) {
  opacity: 0.5;
  cursor: default;
}

.rest-cell.is-readonly.is-finalized {
  cursor: default;
}

.rest-cell.is-readonly:not(.is-finalized):hover {
  border-color: transparent;
  background: inherit;
}

.rest-cell.is-readonly:not(.is-finalized).is-saturday:hover {
  background: var(--el-fill-color-lighter);
}

.rest-cell.is-readonly:not(.is-finalized).is-sunday:hover {
  background: var(--el-fill-color-extra-light);
}

.rest-cell.is-readonly.is-rest:hover {
  background: var(--el-color-success-light-6);
}

.rest-cell.is-readonly.is-saved:hover {
  background: var(--el-color-primary-light-6);
}

.rest-cell.is-readonly.is-finalized:hover,
.rest-cell.is-readonly.is-finalized.is-saturday:hover,
.rest-cell.is-readonly.is-finalized.is-sunday:hover {
  background: #ddd6fe;
  border-color: #7c3aed;
}
</style>