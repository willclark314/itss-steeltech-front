<script setup lang="ts">
import { computed, ref, toRef } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Coin, DeleteFilled, Edit } from '@element-plus/icons-vue'
import { PersonnelLeaveForm } from '@/models/personnel'
import type { CalendarDayCell, CalendarMonth, LeaveEntryType } from '@/models/personnel'
import { saveLeaveEntry, deleteLeaveEntry, type LeaveEntryDTO } from '@/api/leave'

const props = withDefaults(
  defineProps<{
    personnelIds: string[]
    calendarMonths: CalendarMonth[]
    dtoLookup: Map<string, LeaveEntryDTO>
    hoveredMonth: number | null
    pinnedMonth: number | null
    actualEntryIds: Set<string>
    /** 手工请假记录 ID（用于勾标橙色） */
    requestEntryIds: Set<string>
    hoveredPersonnelId: string | null
    hoveredMonthPersonnelIds: Set<string>
    /** 员工视图：无月份筛选、无人员高亮 */
    simpleMode?: boolean
    /** 允许点击/右键编辑休假（员工本人日历） */
    editable?: boolean
  }>(),
  { simpleMode: false, editable: false },
)

const emit = defineEmits<{
  editEntry: [event: CalendarDayCell['events'][number]]
  loadCalendar: []
  togglePinMonth: [month: number]
  hoverMonth: [month: number | null]
}>()

const personnelIds = toRef(props, 'personnelIds')

const canEditLeave = computed(() => props.editable || !props.simpleMode)

const weekdayLabels = PersonnelLeaveForm.WEEKDAY_LABELS
const leaveTypeMap = PersonnelLeaveForm.TYPE_MAP

const dayCtxVisible = ref(false)
const dayCtxEvents = ref<CalendarDayCell['events']>([])
const dayCtxX = ref(0)
const dayCtxY = ref(0)

const multiEvents = ref<CalendarDayCell['events']>([])
const multiVisible = ref(false)
const multiDate = ref('')

function openDayContextMenu(event: MouseEvent, cell: CalendarDayCell) {
  if (!cell.events.length) return
  dayCtxEvents.value = cell.events
  dayCtxX.value = event.clientX
  dayCtxY.value = event.clientY
  dayCtxVisible.value = true
}

function closeDayContextMenu() {
  dayCtxVisible.value = false
}

function isActualEntry(event: CalendarDayCell['events'][number]) {
  if (props.actualEntryIds.has(event.id)) return true
  const dto = props.dtoLookup.get(event.id)
  return dto != null && !dto.computed
}

function resolveEntryId(event: CalendarDayCell['events'][number]) {
  return props.dtoLookup.get(event.id)?.id ?? event.id
}

async function handleDaySave(event: CalendarDayCell['events'][number]) {
  try {
    const dto = props.dtoLookup.get(event.id)
    const payload: Partial<LeaveEntryDTO> = {
      id: dto?.id,
      personnelId: event.personnelId,
      type: event.type as LeaveEntryDTO['type'],
      startDate: event.startDate,
      endDate: event.endDate,
      plannedDays: dto?.plannedDays ?? 0,
      status: (dto?.status ?? event.status) as LeaveEntryDTO['status'],
      reason: event.reason || dto?.reason || '',
      remark: dto?.remark || '',
      computed: dto?.computed ?? true,
    }
    await saveLeaveEntry(payload)
    ElMessage.success('休假记录已保存')
    closeDayContextMenu()
    emit('loadCalendar')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : '保存失败')
  }
}

function handleDayEdit(event: CalendarDayCell['events'][number]) {
  closeDayContextMenu()
  emit('editEntry', event)
}

async function handleDayDelete(event: CalendarDayCell['events'][number]) {
  if (!isActualEntry(event)) return
  const entryId = resolveEntryId(event)
  try {
    await ElMessageBox.confirm(
      `确认永久删除 ${event.employeeName} 的这段休假记录？此操作不可撤销。`,
      '删除休假',
      { confirmButtonText: '确认删除', cancelButtonText: '返回', type: 'warning' },
    )
    await deleteLeaveEntry(entryId)
    ElMessage.success('已删除')
    closeDayContextMenu()
    emit('loadCalendar')
  } catch {
    // 用户取消操作
  }
}

function onDayClick(cell: CalendarDayCell) {
  if (!cell.events.length) return
  if (cell.events.length === 1) {
    emit('editEntry', cell.events[0])
  } else {
    multiEvents.value = cell.events
    multiDate.value = cell.date
    multiVisible.value = true
  }
}

function hasHoveredPersonLeave(cell: CalendarDayCell) {
  if (!props.hoveredPersonnelId) return false
  return cell.events.some((event) => event.personnelId === props.hoveredPersonnelId)
}

function hasHoveredMonthPersonLeave(cell: CalendarDayCell) {
  if (props.hoveredMonth === null) return false
  return cell.events.some((event) => props.hoveredMonthPersonnelIds.has(event.personnelId))
}

function hasActualEntry(cell: CalendarDayCell) {
  return cell.events.some((event) => props.actualEntryIds.has(event.id))
}

/** 年休：计划轮休；请假：手工申请 */
function resolveEventLeaveCategory(event: CalendarDayCell['events'][number]): 'annual' | 'request' {
  const dto = props.dtoLookup.get(event.id)
  const type = dto?.type ?? event.type
  if (type === 'request' || type === 'extended' || type === 'early') return 'request'
  if (props.requestEntryIds.has(event.id)) return 'request'
  return 'annual'
}

function resolvePersistedCellLeaveCategory(cell: CalendarDayCell): 'annual' | 'request' | null {
  const persistedEvents = cell.events.filter((event) => props.actualEntryIds.has(event.id))
  if (!persistedEvents.length) return null
  const categories = persistedEvents.map((event) => resolveEventLeaveCategory(event))
  return categories.includes('request') ? 'request' : 'annual'
}

function getLeaveTypeMeta(type: LeaveEntryType) {
  return leaveTypeMap[type]
}

function getDayClass(cell: CalendarDayCell, month: number) {
  if (!cell.inMonth) return 'is-outside'
  const classes: string[] = []
  if (cell.events.length) classes.push('has-leave')
  if (props.simpleMode) return classes.join(' ')
  if (props.hoveredPersonnelId) {
    if (hasHoveredPersonLeave(cell)) {
      classes.push('is-highlighted')
    } else if (cell.events.length) {
      classes.push('is-dimmed')
    }
  } else if (props.hoveredMonth === month) {
    if (hasHoveredMonthPersonLeave(cell)) {
      classes.push('is-highlighted')
    } else if (cell.events.length) {
      classes.push('is-dimmed')
    }
  }
  return classes.join(' ')
}

function getDayStyle(cell: CalendarDayCell, month: number) {
  if (!cell.events.length) return {}
  if (props.simpleMode) {
    return PersonnelLeaveForm.getDayBackgroundStyle(cell.events, personnelIds.value)
  }

  if (props.hoveredPersonnelId) {
    if (hasHoveredPersonLeave(cell)) {
      const color = PersonnelLeaveForm.getEmployeeColor(
        props.hoveredPersonnelId,
        personnelIds.value,
      )
      return {
        background: PersonnelLeaveForm.colorWithAlpha(color, 0.72),
        borderColor: color,
        boxShadow: `inset 0 0 0 1px ${color}`,
      }
    }
    const baseStyle = PersonnelLeaveForm.getDayBackgroundStyle(cell.events, personnelIds.value)
    return { ...baseStyle, opacity: '0.22' }
  }

  if (props.hoveredMonth === month) {
    if (hasHoveredMonthPersonLeave(cell)) {
      const baseStyle = PersonnelLeaveForm.getDayBackgroundStyle(cell.events, personnelIds.value)
      return { ...baseStyle, boxShadow: 'inset 0 0 0 1.5px var(--el-color-primary)' }
    }
    const baseStyle = PersonnelLeaveForm.getDayBackgroundStyle(cell.events, personnelIds.value)
    return { ...baseStyle, opacity: '0.22' }
  }

  return PersonnelLeaveForm.getDayBackgroundStyle(cell.events, personnelIds.value)
}

function getEventColor(event: CalendarDayCell['events'][number]) {
  return PersonnelLeaveForm.getEmployeeColor(event.personnelId, personnelIds.value)
}
</script>

<template>
  <div class="leave-calendar-panel" :class="{ 'is-simple-mode': simpleMode }">
    <div class="year-calendar">
      <div
        v-for="month in calendarMonths"
        :key="month.month"
        class="month-card"
        :class="{
          'is-month-active': !simpleMode && hoveredMonth === month.month,
          'is-pinned': !simpleMode && pinnedMonth === month.month,
        }"
      >
        <div
          class="month-title"
          :class="{
            'is-month-hovered': !simpleMode && hoveredMonth === month.month,
            'is-pinned': !simpleMode && pinnedMonth === month.month,
            'is-readonly': simpleMode,
          }"
          @mouseenter="!simpleMode && emit('hoverMonth', month.month)"
          @mouseleave="!simpleMode && emit('hoverMonth', null)"
          @click="!simpleMode && emit('togglePinMonth', month.month)"
        >
          {{ month.label }}
        </div>

        <div class="weekday-row">
          <span
            v-for="weekday in weekdayLabels"
            :key="weekday"
            class="weekday-cell"
          >
            {{ weekday }}
          </span>
        </div>

        <div class="days-grid">
          <el-tooltip
            v-for="(cell, index) in month.days"
            :key="`${month.month}-${index}`"
            placement="top"
            :disabled="!cell.inMonth || !cell.events.length"
            :show-after="150"
            :hide-after="0"
          >
            <template #content>
              <div v-if="cell.inMonth && cell.events.length" class="tooltip-card">
                <div class="tooltip-date">{{ cell.date }}</div>
                <div class="tooltip-divider" />
                <div
                  v-for="event in cell.events"
                  :key="event.id"
                  class="tooltip-event"
                >
                  <span
                    v-if="!simpleMode"
                    class="tooltip-dot"
                    :style="{ background: getEventColor(event) }"
                  />
                  <span v-if="!simpleMode" class="tooltip-name">{{ event.employeeName }}</span>
                  <span class="tooltip-type">
                    {{ getLeaveTypeMeta(event.type).label }}
                  </span>
                  <span class="tooltip-range">
                    {{ event.startDate }} ~ {{ event.endDate }}
                  </span>
                </div>
              </div>
            </template>
            <div
              class="day-cell"
              :class="[
                getDayClass(cell, month.month),
                {
                  'is-today': cell.isToday,
                  'is-clickable': canEditLeave && cell.inMonth && cell.events.length,
                  'is-saved': canEditLeave && hasActualEntry(cell),
                },
              ]"
              :style="getDayStyle(cell, month.month)"
              @click="canEditLeave && cell.inMonth && cell.events.length && onDayClick(cell)"
              @contextmenu.prevent="canEditLeave && cell.inMonth && cell.events.length && openDayContextMenu($event, cell)"
            >
              <span v-if="cell.inMonth" class="day-number">{{ cell.day }}</span>
              <i
                v-if="cell.inMonth && resolvePersistedCellLeaveCategory(cell)"
                class="day-checkmark"
                :class="`is-${resolvePersistedCellLeaveCategory(cell)}`"
              />
            </div>
          </el-tooltip>
        </div>
      </div>
    </div>

    <Teleport v-if="canEditLeave" to="body">
      <div
        v-if="dayCtxVisible"
        class="ctx-menu-backdrop"
        @click="closeDayContextMenu"
        @contextmenu.prevent="closeDayContextMenu"
      >
        <div
          class="ctx-menu-card"
          :style="{ left: dayCtxX + 'px', top: dayCtxY + 'px' }"
          @click.stop
        >
          <template v-for="(event, index) in dayCtxEvents" :key="event.id">
            <div v-if="index > 0" class="ctx-menu-divider" />
            <div v-if="dayCtxEvents.length > 1" class="ctx-menu-label">{{ event.employeeName }}</div>
            <button
              v-if="!isActualEntry(event)"
              type="button"
              class="ctx-menu-item"
              @click="handleDaySave(event)"
            >
              <el-icon><Coin /></el-icon>
              保存
            </button>
            <button
              v-if="isActualEntry(event)"
              type="button"
              class="ctx-menu-item"
              @click="handleDayEdit(event)"
            >
              <el-icon><Edit /></el-icon>
              修改
            </button>
            <button
              v-if="isActualEntry(event)"
              type="button"
              class="ctx-menu-item ctx-menu-item--danger"
              @click="handleDayDelete(event)"
            >
              <el-icon><DeleteFilled /></el-icon>
              删除
            </button>
          </template>
        </div>
      </div>
    </Teleport>

    <Teleport v-if="canEditLeave" to="body">
      <div
        v-if="multiVisible"
        class="multi-select-backdrop"
        @click="multiVisible = false"
      >
        <div class="multi-select-card" @click.stop>
          <div class="multi-select-header">
            {{ multiDate }}
            <span class="multi-select-count">{{ multiEvents.length }} 人休假</span>
          </div>
          <button
            v-for="event in multiEvents"
            :key="event.id"
            type="button"
            class="multi-select-item"
            @click="multiVisible = false; emit('editEntry', event)"
          >
            <i
              class="multi-select-dot"
              :style="{ background: getEventColor(event) }"
            />
            <span class="multi-select-name">{{ event.employeeName }}</span>
            <span class="multi-select-type">
              {{ leaveTypeMap[event.type]?.label ?? event.type }}
            </span>
            <span class="multi-select-date">
              {{ event.startDate }} ~ {{ event.endDate }}
            </span>
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.leave-calendar-panel {
  flex: 1;
  min-height: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.year-calendar {
  flex: 1;
  min-height: 0;
  width: 100%;
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  grid-template-rows: repeat(3, minmax(0, 1fr));
  gap: 4px;
}

.month-card {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 3px 4px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 4px;
  background: var(--el-bg-color);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.month-card.is-month-active {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 0 0 1px var(--el-color-primary-light-7);
}

.month-card.is-pinned {
  border-color: var(--el-color-primary);
  box-shadow: 0 0 0 2px var(--el-color-primary-light-5);
}

.month-title {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--el-text-color-primary);
  text-align: center;
  cursor: pointer;
  padding: 2px 0;
  border-radius: 4px;
  transition: background-color 0.15s, color 0.15s;
  user-select: none;
}

.month-title:hover {
  background: var(--el-fill-color-light);
}

.month-title.is-month-hovered {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.month-title.is-pinned {
  background: var(--el-color-primary-light-7);
  color: #fff;
}

.month-title.is-readonly {
  cursor: default;
}

.month-title.is-readonly:hover {
  background: transparent;
}

.is-simple-mode .day-cell.has-leave {
  transition: none;
}

.weekday-row,
.days-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 1px;
}

.weekday-row {
  flex-shrink: 0;
  margin-top: 2px;
}

.days-grid {
  flex: 1;
  min-height: 0;
  grid-template-rows: repeat(6, minmax(0, 1fr));
  margin-top: 1px;
  align-content: stretch;
}

.days-grid :deep(.el-tooltip__trigger) {
  display: flex;
  min-width: 0;
  min-height: 0;
  width: 100%;
  height: 100%;
}

.weekday-cell {
  text-align: center;
  font-size: 9px;
  line-height: 1.1;
  color: var(--el-text-color-placeholder);
}

.day-cell {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  border-radius: 2px;
  border: 1px solid transparent;
}

.day-cell.is-outside {
  visibility: hidden;
}

.day-cell:not(.is-outside):hover {
  border-color: var(--el-border-color);
}

.day-cell.is-clickable {
  cursor: pointer;
}

.day-cell.is-clickable:hover {
  border-color: var(--el-color-primary);
}

.day-cell.has-leave {
  transition: background-color 0.15s, border-color 0.15s, opacity 0.15s, box-shadow 0.15s;
}

.day-cell.is-highlighted {
  z-index: 1;
}

.day-cell.is-highlighted .day-number {
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.day-checkmark {
  display: block;
  position: absolute;
  top: 1px;
  right: 1px;
  width: 8px;
  height: 8px;
}

.day-checkmark::before {
  content: '';
  display: block;
  width: 100%;
  height: 100%;
  background: #67c23a;
  border-radius: 50%;
}

.day-checkmark.is-annual::before {
  background: #67c23a;
}

.day-checkmark.is-request::before {
  background: #e6a23c;
}

.day-checkmark::after {
  content: '';
  position: absolute;
  top: 1.5px;
  left: 2px;
  width: 3.5px;
  height: 2px;
  border-left: 1px solid #fff;
  border-bottom: 1px solid #fff;
  transform: rotate(-45deg);
}

.day-cell.is-today .day-number {
  color: var(--el-color-primary);
  font-weight: 700;
}

.day-number {
  font-size: 9px;
  line-height: 1;
  color: var(--el-text-color-regular);
  user-select: none;
}

.ctx-menu-backdrop {
  position: fixed;
  inset: 0;
  z-index: 3000;
}

.ctx-menu-card {
  position: fixed;
  z-index: 3001;
  min-width: 140px;
  padding: 4px 0;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color);
  border-radius: 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  animation: ctx-in 0.1s ease;
}

@keyframes ctx-in {
  from { opacity: 0; transform: scale(0.95); }
  to   { opacity: 1; transform: scale(1); }
}

.ctx-menu-item {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  padding: 6px 12px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  color: var(--el-text-color-primary);
  text-align: left;
  transition: background 0.1s;
}

.ctx-menu-item:hover {
  background: var(--el-fill-color-light);
}

.ctx-menu-item .el-icon {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.ctx-menu-item--danger {
  color: var(--el-color-danger);
}

.ctx-menu-item--danger .el-icon {
  color: var(--el-color-danger);
}

.ctx-menu-item--danger:hover {
  background: var(--el-color-danger-light-9);
}

.ctx-menu-divider {
  height: 1px;
  margin: 4px 8px;
  background: var(--el-border-color-lighter);
}

.ctx-menu-label {
  padding: 4px 12px 2px;
  font-size: 11px;
  font-weight: 600;
  color: var(--el-text-color-secondary);
}

.multi-select-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.18);
}

.multi-select-card {
  min-width: 280px;
  max-width: 400px;
  background: var(--el-bg-color);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
  padding: 8px 0;
  animation: multi-in 0.15s ease;
}

@keyframes multi-in {
  from { opacity: 0; transform: scale(0.94); }
  to   { opacity: 1; transform: scale(1); }
}

.multi-select-header {
  padding: 8px 16px 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  border-bottom: 1px solid var(--el-border-color-lighter);
  margin-bottom: 4px;
}

.multi-select-count {
  margin-left: 8px;
  font-size: 11px;
  font-weight: 400;
  color: var(--el-text-color-placeholder);
}

.multi-select-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 8px 16px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 13px;
  color: var(--el-text-color-primary);
  text-align: left;
  transition: background 0.1s;
}

.multi-select-item:hover {
  background: var(--el-fill-color-light);
}

.multi-select-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.multi-select-name {
  font-weight: 500;
  min-width: 48px;
}

.multi-select-type {
  font-size: 11px;
  color: var(--el-text-color-secondary);
  min-width: 56px;
}

.multi-select-date {
  font-size: 11px;
  color: var(--el-text-color-placeholder);
  margin-left: auto;
}
</style>

<style>
.tooltip-card {
  min-width: 170px;
  max-width: 280px;
  padding: 2px 0;
  font-size: 13px;
  line-height: 1.5;
}

.tooltip-date {
  font-weight: 600;
  font-size: 13px;
  padding: 0 2px 6px;
}

.tooltip-divider {
  height: 1px;
  margin: 0 0 6px;
  background: rgba(255, 255, 255, 0.25);
}

.tooltip-event {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 2px;
}

.tooltip-event + .tooltip-event {
  border-top: 1px solid rgba(255, 255, 255, 0.15);
}

.tooltip-type {
  font-size: 12px;
  white-space: nowrap;
  color: rgba(255, 255, 255, 0.8);
}

.tooltip-range {
  font-size: 11px;
  white-space: nowrap;
  color: rgba(255, 255, 255, 0.6);
  margin-left: auto;
}

html.dark .tooltip-divider {
  background: #000;
}

html.dark .tooltip-event + .tooltip-event {
  border-top-color: #000;
}

html.dark .tooltip-type {
  color: #000;
}

html.dark .tooltip-range {
  color: #000;
}

.tooltip-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tooltip-name {
  font-weight: 500;
  white-space: nowrap;
}
</style>
