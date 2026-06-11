<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { fetchPersonnelList } from '@/api/personnel'
import { PersonnelForm, PersonnelLeaveForm } from '@/models/personnel'
import type { CalendarDayCell, LeaveEntryStatus, LeaveEntryType } from '@/models/personnel'

const currentYear = PersonnelLeaveForm.getCurrentYear()
const weekdayLabels = PersonnelLeaveForm.WEEKDAY_LABELS
const teamOptions = PersonnelForm.TEAM_OPTIONS

const searchForm = reactive({
  year: currentYear,
})

const leaveTypeMap = PersonnelLeaveForm.TYPE_MAP
const leaveStatusMap = PersonnelLeaveForm.STATUS_MAP

const leaveEntries = PersonnelLeaveForm.cloneEntries()
const personnelList = ref(PersonnelForm.cloneSamples())
const personnelIds = computed(() => personnelList.value.map((item) => item.id))

const groupVisible = reactive<Record<string, boolean>>({
  设计组: true,
  细化组: true,
})

const groupExpanded = reactive<Record<string, boolean>>({
  设计组: true,
  细化组: true,
})

const personVisible = reactive<Record<string, boolean>>(
  Object.fromEntries(personnelList.value.map((item) => [item.id, true])),
)

const hoveredPersonnelId = ref<string | null>(null)

const filteredRows = computed(() =>
  PersonnelLeaveForm.buildTableRows(leaveEntries, personnelList.value, searchForm),
)

const teamGroups = computed(() =>
  PersonnelLeaveForm.buildTeamGroups(personnelList.value, filteredRows.value, teamOptions),
)

const visiblePersonnelIds = computed(() =>
  personnelList.value
    .filter((person) => groupVisible[person.team] && personVisible[person.id])
    .map((person) => person.id),
)

const visibleRows = computed(() =>
  filteredRows.value.filter((row) => visiblePersonnelIds.value.includes(row.personnelId)),
)

const calendarMonths = computed(() =>
  PersonnelLeaveForm.buildYearCalendar(searchForm.year, visibleRows.value),
)

function changeYear(delta: number) {
  searchForm.year += delta
}

function isPersonShown(personnelId: string, team: string) {
  return Boolean(groupVisible[team] && personVisible[personnelId])
}

function getTeamMembers(team: string) {
  return personnelList.value.filter((person) => person.team === team)
}

function isGroupFullyShown(team: string) {
  const members = getTeamMembers(team)
  if (!members.length) return Boolean(groupVisible[team])
  return groupVisible[team] && members.every((person) => personVisible[person.id])
}

function toggleGroupVisibility(team: string) {
  const members = getTeamMembers(team)
  const nextVisible = !isGroupFullyShown(team)

  groupVisible[team] = nextVisible
  for (const member of members) {
    personVisible[member.id] = nextVisible
  }
}

function toggleGroupExpanded(team: string) {
  groupExpanded[team] = !groupExpanded[team]
}

function togglePersonVisibility(personnelId: string) {
  personVisible[personnelId] = !personVisible[personnelId]
}

function onPersonMouseEnter(personnelId: string) {
  hoveredPersonnelId.value = personnelId
}

function onPersonMouseLeave() {
  hoveredPersonnelId.value = null
}

function hasHoveredPersonLeave(cell: CalendarDayCell) {
  if (!hoveredPersonnelId.value) return false
  return cell.events.some((event) => event.personnelId === hoveredPersonnelId.value)
}

function getLeaveTypeMeta(type: LeaveEntryType) {
  return leaveTypeMap[type]
}

function getLeaveStatusMeta(status: LeaveEntryStatus) {
  return leaveStatusMap[status]
}

function getDayClass(cell: CalendarDayCell) {
  if (!cell.inMonth) return 'is-outside'
  const classes: string[] = []
  if (cell.events.length) classes.push('has-leave')
  if (hoveredPersonnelId.value) {
    if (hasHoveredPersonLeave(cell)) {
      classes.push('is-highlighted')
    } else if (cell.events.length) {
      classes.push('is-dimmed')
    }
  }
  return classes.join(' ')
}

function getDayStyle(cell: CalendarDayCell) {
  if (!cell.events.length) return {}

  if (hoveredPersonnelId.value) {
    if (hasHoveredPersonLeave(cell)) {
      const color = PersonnelLeaveForm.getEmployeeColor(
        hoveredPersonnelId.value,
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

  return PersonnelLeaveForm.getDayBackgroundStyle(cell.events, personnelIds.value)
}

async function loadPersonnel() {
  try {
    personnelList.value = await fetchPersonnelList()
    for (const person of personnelList.value) {
      if (personVisible[person.id] === undefined) {
        personVisible[person.id] = true
      }
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '加载人员数据失败')
  }
}

onMounted(() => {
  void loadPersonnel()
})

function formatDayTooltip(cell: CalendarDayCell) {
  if (!cell.events.length) {
    return `${cell.date}\n无休假`
  }

  const lines = cell.events.map((event) => {
    const typeLabel = getLeaveTypeMeta(event.type).label
    const statusLabel = getLeaveStatusMeta(event.status).label
    return `${event.employeeName} · ${typeLabel} · ${statusLabel}`
  })

  return `${cell.date}\n${lines.join('\n')}`
}
</script>

<template>
  <div class="leave-page">
    <div class="leave-toolbar">
      <div class="year-switcher">
        <el-button link @click="changeYear(-1)">
          <el-icon><ArrowLeft /></el-icon>
        </el-button>
        <span class="year-label">{{ searchForm.year }}</span>
        <el-button link @click="changeYear(1)">
          <el-icon><ArrowRight /></el-icon>
        </el-button>
      </div>

      <div class="team-filters">
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
            <button
              v-for="member in group.members"
              :key="member.personnelId"
              type="button"
              class="member-toggle"
              :class="{
                'is-off': !isPersonShown(member.personnelId, group.team),
                'is-hovered': hoveredPersonnelId === member.personnelId,
              }"
              @click="togglePersonVisibility(member.personnelId)"
              @mouseenter="onPersonMouseEnter(member.personnelId)"
              @mouseleave="onPersonMouseLeave"
            >
              <i class="legend-dot" :style="{ background: member.color }" />
              {{ member.name }}
            </button>
          </div>
        </div>
      </div>
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
            :disabled="!cell.inMonth || !cell.events.length"
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
.leave-page {
  --layout-top-height: 48px;
  --layout-tabs-height: 40px;
  margin: -16px -12px;
  height: calc(100vh - var(--layout-top-height) - var(--layout-tabs-height) - 10px);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.leave-toolbar {
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
