<script setup lang="ts">
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchProjectList } from '@/api/projects'
import { ProjectScheduleForm } from '@/models/biz/project'
import type { CalendarDayCell } from '@/models/biz/project'
import { PersonnelForm } from '@/models/personnel'

const currentYear = ProjectScheduleForm.getCurrentYear()
const weekdayLabels = ProjectScheduleForm.WEEKDAY_LABELS
const teamOptions = PersonnelForm.TEAM_OPTIONS

const searchForm = reactive({
  year: currentYear,
})

const loading = ref(false)
const scheduleRows = ref(ProjectScheduleForm.buildScheduleRows([]))
const personnelIds = computed(() => ProjectScheduleForm.collectPersonnelIds(scheduleRows.value))

const groupVisible = reactive<Record<string, boolean>>({
  设计组: true,
  细化组: true,
})

const groupExpanded = reactive<Record<string, boolean>>({
  设计组: true,
  细化组: true,
})

const personVisible = reactive<Record<string, boolean>>({})
const hoveredPersonnelId = ref<string | null>(null)
const HOVER_HIGHLIGHT_DELAY = 500
let hoverHighlightTimer: ReturnType<typeof setTimeout> | null = null

const teamGroups = computed(() =>
  ProjectScheduleForm.buildTeamPersonnelGroups(scheduleRows.value, teamOptions),
)

const visibleRows = computed(() =>
  ProjectScheduleForm.filterVisibleRows(
    scheduleRows.value,
    groupVisible,
    personVisible,
  ),
)

const calendarMonths = computed(() => {
  const months = ProjectScheduleForm.buildYearCalendar(searchForm.year, visibleRows.value)
  return months.map((month) => ({
    ...month,
    days: month.days.map((cell) => ({
      ...cell,
      events: ProjectScheduleForm.filterDayEventsByVisiblePersonnel(cell.events, personVisible),
    })),
  }))
})

function changeYear(delta: number) {
  searchForm.year += delta
  void loadProjects()
}

function getTeamMembers(team: string) {
  return teamGroups.value.find((group) => group.team === team)?.members ?? []
}

function isPersonShown(personnelId: string) {
  return ProjectScheduleForm.isPersonVisible(personnelId, personVisible)
}

function isGroupFullyShown(team: string) {
  const members = getTeamMembers(team)
  if (!members.length) return false
  return members.every((member) => ProjectScheduleForm.isPersonVisible(member.personnelId, personVisible))
}

function toggleGroupVisibility(team: string) {
  const members = getTeamMembers(team)
  const nextVisible = !isGroupFullyShown(team)

  groupVisible[team] = nextVisible
  for (const member of members) {
    personVisible[member.personnelId] = nextVisible
  }
}

function toggleGroupExpanded(team: string) {
  groupExpanded[team] = !groupExpanded[team]
}

function togglePersonVisibility(personnelId: string) {
  personVisible[personnelId] = !ProjectScheduleForm.isPersonVisible(personnelId, personVisible)
}

function showOnlyPerson(personnelId: string) {
  for (const id of personnelIds.value) {
    personVisible[id] = id === personnelId
  }
}

function handlePersonMenuCommand(command: string, personnelId: string) {
  if (command === 'showOnly') {
    showOnlyPerson(personnelId)
  }
}

function clearHoverHighlightTimer() {
  if (hoverHighlightTimer) {
    clearTimeout(hoverHighlightTimer)
    hoverHighlightTimer = null
  }
}

function onPersonMouseEnter(personnelId: string) {
  clearHoverHighlightTimer()
  hoverHighlightTimer = setTimeout(() => {
    hoveredPersonnelId.value = personnelId
    hoverHighlightTimer = null
  }, HOVER_HIGHLIGHT_DELAY)
}

function onPersonMouseLeave() {
  clearHoverHighlightTimer()
  hoveredPersonnelId.value = null
}

function getHoveredPersonDayEvents(date: string) {
  if (!hoveredPersonnelId.value) return []
  return ProjectScheduleForm.getPersonDayEvents(
    date,
    scheduleRows.value,
    hoveredPersonnelId.value,
  )
}

function hasHoveredPersonSchedule(cell: CalendarDayCell) {
  if (!hoveredPersonnelId.value || !cell.inMonth) return false
  return getHoveredPersonDayEvents(cell.date).length > 0
}

function getDayClass(cell: CalendarDayCell) {
  if (!cell.inMonth) return 'is-outside'
  const classes: string[] = []
  const hoveredHasSchedule = hasHoveredPersonSchedule(cell)
  if (cell.events.length || hoveredHasSchedule) classes.push('has-schedule')
  if (hoveredPersonnelId.value) {
    if (hoveredHasSchedule) {
      classes.push('is-highlighted')
    } else if (cell.events.length) {
      classes.push('is-dimmed')
    }
  }
  return classes.join(' ')
}

function getHoveredPersonHighlightStyle() {
  if (!hoveredPersonnelId.value) return {}

  const color = ProjectScheduleForm.getPersonnelColor(
    hoveredPersonnelId.value,
    personnelIds.value,
  )
  return {
    background: ProjectScheduleForm.colorWithAlpha(color, 0.72),
    borderColor: color,
    boxShadow: `inset 0 0 0 1px ${color}`,
  }
}

function getDayStyle(cell: CalendarDayCell) {
  if (hoveredPersonnelId.value) {
    if (hasHoveredPersonSchedule(cell)) {
      return getHoveredPersonHighlightStyle()
    }

    if (cell.events.length) {
      const baseStyle = ProjectScheduleForm.getDayBackgroundStyle(
        cell.events,
        personnelIds.value,
      )
      return { ...baseStyle, opacity: '0.22' }
    }

    return {}
  }

  if (!cell.events.length) return {}

  return ProjectScheduleForm.getDayBackgroundStyle(cell.events, personnelIds.value)
}

function getDayTooltipEvents(cell: CalendarDayCell) {
  if (hoveredPersonnelId.value) {
    return getHoveredPersonDayEvents(cell.date)
  }
  return cell.events
}

function hasDayTooltip(cell: CalendarDayCell) {
  return cell.inMonth && getDayTooltipEvents(cell).length > 0
}

function formatDayTooltip(cell: CalendarDayCell) {
  const events = getDayTooltipEvents(cell)

  if (!events.length) {
    return `${cell.date}\n无项目安排`
  }

  const lines = events.map((event) => {
    const statusLabel = ProjectScheduleForm.getStatusLabel(event.status)
    const natureLabel = ProjectScheduleForm.getNatureLabels(event.natures)
    const range = ProjectScheduleForm.formatEventRange(event)
    const assignees = ProjectScheduleForm.formatAssigneeNames(event)
    const natureText = natureLabel ? ` · ${natureLabel}` : ''
    return `${event.projectNo} · ${event.name} · ${assignees} · ${statusLabel}${natureText}\n计划：${range}`
  })

  return `${cell.date}\n${lines.join('\n')}`
}

async function loadProjects() {
  loading.value = true
  try {
    const result = await fetchProjectList({ all: true })
    scheduleRows.value = ProjectScheduleForm.buildScheduleRows(result.list, searchForm.year)

    for (const group of ProjectScheduleForm.buildTeamPersonnelGroups(scheduleRows.value, teamOptions)) {
      for (const member of group.members) {
        if (personVisible[member.personnelId] === undefined) {
          personVisible[member.personnelId] = true
        }
      }
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载项目数据失败')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void loadProjects()
})

onUnmounted(() => {
  clearHoverHighlightTimer()
})
</script>

<template>
  <div v-loading="loading" class="schedule-page">
    <div class="schedule-toolbar">
      <div class="year-switcher">
        <el-button link @click="changeYear(-1)">
          <el-icon><ArrowLeft /></el-icon>
        </el-button>
        <span class="year-label">{{ searchForm.year }}</span>
        <el-button link @click="changeYear(1)">
          <el-icon><ArrowRight /></el-icon>
        </el-button>
      </div>

      <div v-if="teamGroups.length" class="team-filters">
        <div
          v-for="group in teamGroups"
          :key="group.team"
          class="team-group"
        >
          <button
            type="button"
            class="team-toggle"
            :class="{ 'is-off': !isGroupFullyShown(group.team) }"
            @click="toggleGroupVisibility(group.team)"
          >
            <i class="team-dot" :class="{ 'is-off': !isGroupFullyShown(group.team) }" />
            {{ group.team }}
          </button>

          <button
            type="button"
            class="team-expand"
            :title="groupExpanded[group.team] ? '收起成员' : '展开成员'"
            @click="toggleGroupExpanded(group.team)"
          >
            <el-icon>
              <ArrowDown v-if="groupExpanded[group.team]" />
              <ArrowRight v-else />
            </el-icon>
          </button>

          <div v-show="groupExpanded[group.team]" class="team-members">
            <el-dropdown
              v-for="member in group.members"
              :key="member.personnelId"
              trigger="contextmenu"
              @command="(command) => handlePersonMenuCommand(command, member.personnelId)"
            >
              <button
                type="button"
                class="member-toggle"
                :class="{
                  'is-off': !isPersonShown(member.personnelId),
                  'is-hovered': hoveredPersonnelId === member.personnelId,
                }"
                :title="`${member.name} · ${member.team}`"
                @click="togglePersonVisibility(member.personnelId)"
                @mouseenter="onPersonMouseEnter(member.personnelId)"
                @mouseleave="onPersonMouseLeave"
              >
                <i class="legend-dot" :style="{ background: member.color }" />
                {{ member.name }}
              </button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="showOnly">仅显示此人的工作日历</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </div>
      </div>

      <div v-else class="empty-hint">当前年份暂无已分配人员的项目安排</div>
    </div>

    <div class="year-calendar">
      <div
        v-for="month in calendarMonths"
        :key="month.month"
        class="month-card"
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
            :key="`${month.month}-${index}`"
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
            </div>
          </el-tooltip>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.schedule-page {
  --layout-top-height: 48px;
  --layout-tabs-height: 40px;
  margin: -16px -12px;
  height: calc(100vh - var(--layout-top-height) - var(--layout-tabs-height) - 10px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.schedule-toolbar {
  display: flex;
  align-items: flex-start;
  flex-shrink: 0;
  gap: 12px;
  margin-bottom: 6px;
  padding: 0 2px;
}

.year-switcher {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  padding-top: 2px;
}

.year-label {
  min-width: 48px;
  text-align: center;
  font-size: 15px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.team-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
  min-width: 0;
  flex: 1;
}

.empty-hint {
  padding-top: 2px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.team-group {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 6px;
}

.team-toggle,
.member-toggle,
.team-expand {
  border: 1px solid var(--el-border-color-lighter);
  background: var(--el-fill-color-light);
  cursor: pointer;
  transition: opacity 0.15s, border-color 0.15s, background-color 0.15s;
}

.team-toggle,
.member-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  color: var(--el-text-color-regular);
  line-height: 1.4;
}

.team-toggle:hover,
.member-toggle:hover,
.team-expand:hover {
  border-color: var(--el-border-color);
  background: var(--el-fill-color);
}

.team-toggle.is-off,
.member-toggle.is-off {
  opacity: 0.45;
}

.member-toggle.is-hovered {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  opacity: 1;
}

.team-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--el-color-primary);
  flex-shrink: 0;
}

.team-dot.is-off {
  background: var(--el-text-color-placeholder);
}

.team-expand {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border-radius: 4px;
  color: var(--el-text-color-secondary);
}

.team-members {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
}

.legend-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.year-calendar {
  flex: 1;
  min-height: 0;
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
}

.month-title {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.2;
  color: var(--el-text-color-primary);
  text-align: center;
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
}

.weekday-cell {
  text-align: center;
  font-size: 9px;
  line-height: 1.1;
  color: var(--el-text-color-placeholder);
}

.day-cell {
  display: flex;
  align-items: center;
  justify-content: center;
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

.day-cell.has-schedule {
  transition: background-color 0.15s, border-color 0.15s, opacity 0.15s, box-shadow 0.15s;
}

.day-cell.is-highlighted {
  z-index: 1;
}

.day-cell.is-highlighted .day-number {
  font-weight: 700;
  color: var(--el-text-color-primary);
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
</style>
