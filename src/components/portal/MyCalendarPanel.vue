<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { ProjectRecord } from '@/models/biz/project'
import { ProjectForm } from '@/models/biz/project'
import { MyCalendarForm, type MyCalendarDayCell } from '@/models/portal/MyCalendarForm'

const props = defineProps<{
  projects: ProjectRecord[]
  loading?: boolean
  highlightedProjectNo?: string
}>()

const panelRef = ref<HTMLElement>()
const todayParts = MyCalendarForm.getTodayParts()
const centerYear = ref(todayParts.year)
const centerMonth = ref(todayParts.month)

const weekdayLabels = MyCalendarForm.WEEKDAY_LABELS

const centerLabel = computed(() =>
  MyCalendarForm.formatMonthLabel(centerYear.value, centerMonth.value),
)

const monthViews = computed(() =>
  MyCalendarForm.buildThreeMonthViews(
    centerYear.value,
    centerMonth.value,
    props.projects,
  ),
)

function shiftMonth(delta: number) {
  const next = MyCalendarForm.shiftMonth(centerYear.value, centerMonth.value, delta)
  centerYear.value = next.year
  centerMonth.value = next.month
}

function goToday() {
  const today = MyCalendarForm.getTodayParts()
  centerYear.value = today.year
  centerMonth.value = today.month
}

function hasDayTooltip(cell: MyCalendarDayCell) {
  return MyCalendarForm.hasDayEvents(cell)
}

function formatDayTooltip(cell: MyCalendarDayCell) {
  return MyCalendarForm.formatDayTooltip(cell)
}

function getDayClass(cell: MyCalendarDayCell) {
  const classes = MyCalendarForm.getDayClass(cell)
  const list = Array.isArray(classes) ? [...classes] : [classes]

  if (props.highlightedProjectNo && cell.inMonth && cell.projects.length) {
    if (MyCalendarForm.isDayHighlightedForProject(cell, props.highlightedProjectNo)) {
      list.push('is-highlighted')
    } else {
      list.push('is-dimmed')
    }
  }

  return list
}

function getDayStyle(cell: MyCalendarDayCell) {
  const style = MyCalendarForm.getDayStyle(cell) ?? {}

  if (!MyCalendarForm.isDayHighlightedForProject(cell, props.highlightedProjectNo)) {
    return Object.keys(style).length ? style : undefined
  }

  const targetNo = ProjectForm.parseBaseProjectNo(props.highlightedProjectNo!)
  const highlightedProject = cell.projects.find(
    (project) => ProjectForm.parseBaseProjectNo(project.projectNo) === targetNo,
  )
  if (!highlightedProject) {
    return Object.keys(style).length ? style : undefined
  }

  return {
    ...style,
    boxShadow: `inset 0 0 0 2px ${highlightedProject.color}`,
  }
}

function focusToProject(project: ProjectRecord) {
  const parts = MyCalendarForm.getProjectFocusMonth(project)
  if (!parts) {
    ElMessage.warning('该项目暂无日期，无法定位日程')
    return false
  }

  centerYear.value = parts.year
  centerMonth.value = parts.month

  nextTick(() => {
    panelRef.value?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  })
  return true
}

function getProjectMilestones(cell: MyCalendarDayCell) {
  return MyCalendarForm.getProjectMilestones(cell.date, cell.projects)
}

defineExpose({ focusToProject })
</script>

<template>
  <section ref="panelRef" v-loading="loading" class="my-calendar-panel">
    <div class="my-calendar-header">
      <span class="my-calendar-title">我的日程</span>
      <div class="calendar-toolbar">
        <div class="month-switcher">
          <el-button link aria-label="上一月" @click="shiftMonth(-1)">
            <el-icon><ArrowLeft /></el-icon>
          </el-button>
          <span class="month-label">{{ centerLabel }}</span>
          <el-button link aria-label="下一月" @click="shiftMonth(1)">
            <el-icon><ArrowRight /></el-icon>
          </el-button>
        </div>

        <div class="calendar-legend">
          <span class="legend-item">
            <i class="legend-swatch legend-swatch--fill" />
            实际执行
          </span>
          <span class="legend-item">
            <i class="legend-swatch legend-swatch--border" />
            计划周期
          </span>
          <el-button link type="primary" @click="goToday">回到本月</el-button>
        </div>
      </div>
    </div>

    <div class="three-month-calendar">
      <div
        v-for="month in monthViews"
        :key="`${month.year}-${month.month}`"
        class="month-card"
        :class="{ 'is-center': month.isCenter }"
      >
        <div class="month-title">{{ month.label }}</div>

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
            :key="`${month.year}-${month.month}-${index}`"
            :content="cell.inMonth ? formatDayTooltip(cell) : ''"
            placement="top"
            :disabled="!hasDayTooltip(cell)"
            :show-after="150"
          >
            <div
              class="day-cell"
              :class="[
                getDayClass(cell),
                { 'is-today': cell.isToday },
              ]"
              :style="getDayStyle(cell)"
            >
              <span v-if="cell.inMonth" class="day-number">{{ cell.day }}</span>
              <div
                v-if="cell.inMonth && getProjectMilestones(cell).length"
                class="project-milestones"
              >
                <span
                  v-for="(milestone, milestoneIndex) in getProjectMilestones(cell)"
                  :key="`${milestone.projectNo}-${milestone.kind}-${milestoneIndex}`"
                  class="milestone-dot"
                  :style="{ background: milestone.color }"
                  :title="milestone.name"
                />
              </div>
            </div>
          </el-tooltip>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.my-calendar-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
  min-height: 0;
  height: 100%;
}

.my-calendar-header {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  min-width: 0;
}

.my-calendar-title {
  flex-shrink: 0;
  font-size: 14px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.calendar-toolbar {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  min-width: 0;
  flex: 1;
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
  color: var(--el-text-color-primary);
}

.calendar-legend {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.legend-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.legend-swatch {
  width: 14px;
  height: 10px;
  border-radius: 2px;
  flex-shrink: 0;
}

.legend-swatch--fill {
  background: rgba(64, 158, 255, 0.28);
}

.legend-swatch--border {
  border: 2px solid transparent;
  background:
    linear-gradient(var(--el-bg-color), var(--el-bg-color)) padding-box,
    conic-gradient(from -45deg, #409eff 0deg 180deg, #67c23a 180deg 360deg) border-box;
  background-clip: padding-box, border-box;
}

.three-month-calendar {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  flex: 1;
  min-height: 0;
}

.month-card {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  padding: 4px 6px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  background: var(--el-bg-color);
  transition: border-color 0.15s, box-shadow 0.15s;
}

.month-card.is-center {
  border-color: var(--el-color-primary-light-5);
  box-shadow: 0 0 0 1px var(--el-color-primary-light-8);
}

.month-title {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--el-text-color-primary);
  text-align: center;
}

.month-card.is-center .month-title {
  color: var(--el-color-primary);
}

.weekday-row,
.days-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 2px;
}

.weekday-row {
  flex-shrink: 0;
  margin-top: 4px;
}

.days-grid {
  flex: 1;
  min-height: 0;
  grid-template-rows: repeat(6, minmax(0, 1fr));
  margin-top: 2px;
}

.weekday-cell {
  text-align: center;
  font-size: 11px;
  line-height: 1.2;
  color: var(--el-text-color-placeholder);
}

.day-cell {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
  border-radius: 4px;
  border: 1px solid transparent;
}

.day-cell.is-outside {
  visibility: hidden;
}

.day-cell:not(.is-outside):not(.has-project-border):hover {
  border-color: var(--el-border-color);
}

.day-cell.is-today .day-number {
  color: var(--el-color-primary);
  font-weight: 700;
}

.day-cell.is-highlighted .day-number {
  color: var(--el-text-color-primary);
  font-weight: 700;
}

.day-cell.is-dimmed {
  opacity: 0.35;
}

.day-cell.has-events {
  transition: background 0.15s, box-shadow 0.15s, border-color 0.15s;
}

.project-milestones {
  position: absolute;
  top: 2px;
  left: 50%;
  display: flex;
  gap: 2px;
  max-width: calc(100% - 4px);
  transform: translateX(-50%);
}

.milestone-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  flex-shrink: 0;
}

.day-number {
  font-size: 11px;
  line-height: 1;
  color: var(--el-text-color-regular);
}

@media (max-width: 1100px) {
  .three-month-calendar {
    grid-template-columns: 1fr;
  }
}
</style>
